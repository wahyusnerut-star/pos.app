<?php

namespace App\Http\Controllers\Account;

use App\Http\Controllers\Controller;
use App\Models\Cart;
use App\Models\Category;
use App\Models\Customer;
use App\Models\Product;
use App\Models\Profit;
use App\Models\StockMovement;
use App\Models\Transaction;
use App\Models\TransactionDetail;
use DomainException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Midtrans\Config as MidtransConfig;
use Midtrans\Snap;

class TransactionController extends Controller
{
    public function create(Request $request)
    {
        if (!$request->user()->activeCashierShift) {
            return redirect()
                ->route('account.cashier-shifts.create')
                ->with('error', 'Buka shift kasir terlebih dahulu sebelum masuk ke POS.');
        }

        $categories = Category::all();

        $products = Product::with('category')
            ->where('is_active', true)
            ->when($request->q, function ($query) use ($request) {
                $query->where(function ($q) use ($request) {
                    $q->where('title', 'like', '%' . $request->q . '%')
                        ->orWhere('barcode', 'like', '%' . $request->q . '%');
                });
            })
            ->when($request->category_id, function ($query) use ($request) {
                $query->where('category_id', $request->category_id);
            })
            ->latest()
            ->paginate(12);

        $products->appends([
            'q' => $request->q,
            'category_id' => $request->category_id,
        ]);

        $carts = Cart::with('product')
            ->where('cashier_id', $request->user()->id)
            ->latest()
            ->get();

        $customers = Customer::latest()->get();

        return Inertia::render('Account/Transactions/Create', [
            'categories' => $categories,
            'products' => $products,
            'carts' => $carts,
            'customers' => $customers,
        ]);
    }

    public function store(Request $request)
    {
        $user = $request->user();

        if (!$user->activeCashierShift) {
            return response()->json([
                'success' => false,
                'message' => 'Buka shift kasir terlebih dahulu sebelum memproses transaksi.',
            ], 422);
        }

        $request->validate([
            'payment_method' => 'required|in:cash,digital',
            'cash' => 'nullable|integer|min:0|required_if:payment_method,cash',
            'discount' => 'nullable|integer|min:0',
            'customer_id' => 'nullable|exists:customers,id',
            'note' => 'nullable|string|max:1000',
        ]);

        $paymentMethod = $request->payment_method;
        $discount = (int) ($request->discount ?? 0);

        try {
            $transaction = DB::transaction(function () use ($request, $user, $paymentMethod, $discount) {
                $carts = Cart::query()
                    ->where('cashier_id', $user->id)
                    ->orderBy('id')
                    ->lockForUpdate()
                    ->get();

                if ($carts->isEmpty()) {
                    throw new DomainException('Keranjang masih kosong!');
                }

                $products = Product::query()
                    ->whereIn('id', $carts->pluck('product_id')->unique()->values()->all())
                    ->orderBy('id')
                    ->lockForUpdate()
                    ->get()
                    ->keyBy('id');

                $subtotal = (int) $carts->sum(fn ($cart) => (int) $cart->price * (int) $cart->qty);

                if ($discount > $subtotal) {
                    throw new DomainException('Diskon tidak boleh melebihi subtotal belanja.');
                }

                $grandTotal = $subtotal - $discount;
                $cash = $paymentMethod === 'cash' ? (int) $request->cash : 0;

                if ($paymentMethod === 'cash' && $cash < $grandTotal) {
                    throw new DomainException('Uang pembayaran kurang dari total belanja.');
                }

                $change = $paymentMethod === 'cash' ? $cash - $grandTotal : 0;
                $invoice = $this->generateTransactionInvoice();

                $transaction = Transaction::create([
                    'cashier_id' => $user->id,
                    'customer_id' => $request->customer_id,
                    'invoice' => $invoice,
                    'cash' => $cash,
                    'change' => $change,
                    'discount' => $discount,
                    'grand_total' => $grandTotal,
                    'payment_method' => $paymentMethod,
                    'payment_channel' => $paymentMethod === 'cash' ? 'cash' : 'midtrans',
                    'payment_status' => $paymentMethod === 'cash' ? 'paid' : 'pending',
                    'paid_at' => $paymentMethod === 'cash' ? now() : null,
                    'status' => $paymentMethod === 'cash' ? 'completed' : 'pending',
                    'note' => $request->note,
                ]);

                $totalBuyPrice = 0;

                foreach ($carts as $cart) {
                    $product = $products->get($cart->product_id);

                    if (!$product) {
                        throw new DomainException('Produk pada keranjang tidak valid.');
                    }

                    if ((int) $cart->qty > (int) $product->stock) {
                        throw new DomainException('Stok produk ' . $product->title . ' tidak mencukupi.');
                    }

                    $stockBefore = (int) $product->stock;
                    $stockAfter = $stockBefore - (int) $cart->qty;
                    $itemSubtotal = (int) $cart->price * (int) $cart->qty;
                    $totalBuyPrice += (int) $product->buy_price * (int) $cart->qty;

                    TransactionDetail::create([
                        'transaction_id' => $transaction->id,
                        'product_id' => $cart->product_id,
                        'qty' => $cart->qty,
                        'price' => $cart->price,
                        'buy_price' => $product->buy_price,
                        'subtotal' => $itemSubtotal,
                    ]);

                    StockMovement::create([
                        'product_id' => $cart->product_id,
                        'user_id' => $user->id,
                        'type' => 'out',
                        'qty' => $cart->qty,
                        'stock_before' => $stockBefore,
                        'stock_after' => $stockAfter,
                        'reference_type' => Transaction::class,
                        'reference_id' => $transaction->id,
                        'note' => 'Penjualan Invoice: ' . $invoice,
                    ]);

                    $product->update([
                        'stock' => $stockAfter,
                    ]);
                }

                if ($paymentMethod === 'cash') {
                    Profit::create([
                        'transaction_id' => $transaction->id,
                        'total_revenue' => $grandTotal,
                        'total_cost' => $totalBuyPrice,
                        'profit_amount' => $grandTotal - $totalBuyPrice,
                    ]);
                }

                Cart::whereIn('id', $carts->pluck('id'))->delete();

                return $transaction;
            });

            $snapToken = null;

            if ($transaction->payment_method === 'digital') {
                $snapToken = $this->createMidtransSnapToken($transaction);

                $transaction->update([
                    'snap_token' => $snapToken,
                ]);
            }

            return response()->json([
                'success' => true,
                'invoice' => $transaction->invoice,
                'payment_method' => $transaction->payment_method,
                'payment_status' => $transaction->payment_status,
                'snap_token' => $snapToken,
            ]);
        } catch (DomainException $exception) {
            return response()->json([
                'success' => false,
                'message' => $exception->getMessage(),
            ], 422);
        } catch (\Exception $exception) {
            return response()->json([
                'success' => false,
                'message' => 'Terjadi kesalahan sistem.',
            ], 500);
        }
    }

    public function callback(Request $request)
{
    $serverKey = config('midtrans.server_key');

    $signatureKey = hash(
        'sha512',
        $request->order_id .
            $request->status_code .
            $request->gross_amount .
            $serverKey
    );

    if ($signatureKey !== $request->signature_key) {
        return response()->json([
            'message' => 'Invalid signature key',
        ], 403);
    }

    $transaction = Transaction::where('invoice', $request->order_id)->first();

    if (! $transaction) {
        return response()->json([
            'message' => 'Transaction not found',
        ], 404);
    }

    $transactionStatus = $request->input('transaction_status');
    $fraudStatus = $request->input('fraud_status');

    $paymentStatus = 'pending';
    $status = 'pending';

    if ($transactionStatus === 'capture') {
        if ($fraudStatus === 'accept') {
            $paymentStatus = 'paid';
            $status = 'success';
        }
    }

    if ($transactionStatus === 'settlement') {
        $paymentStatus = 'paid';
        $status = 'success';
    }

    if ($transactionStatus === 'pending') {
        $paymentStatus = 'pending';
        $status = 'pending';
    }

    if (in_array($transactionStatus, ['deny', 'cancel', 'failure'])) {
        $paymentStatus = 'failed';
        $status = 'failed';
    }

    if ($transactionStatus === 'expire') {
        $paymentStatus = 'expired';
        $status = 'expired';
    }

    DB::transaction(function () use ($request, $transaction, $paymentStatus, $status) {
        $transaction->update([
            'payment_status' => $paymentStatus,
            'status' => $status,
            'midtrans_transaction_id' => $request->transaction_id,
            'paid_at' => $paymentStatus === 'paid' ? ($transaction->paid_at ?? now()) : $transaction->paid_at,
        ]);

        if ($paymentStatus === 'paid') {
            $profit = TransactionDetail::query()
                ->where('transaction_id', $transaction->id)
                ->with('product')
                ->get()
                ->sum(function ($detail) {
                    return ($detail->product->sell_price - $detail->product->buy_price) * $detail->qty;
                });

            Profit::firstOrCreate(
                [
                    'transaction_id' => $transaction->id,
                ],
                [
                    'total' => $profit,
                ]
            );
        }
    });

    return response()->json([
        'message' => 'Callback processed successfully',
    ]);
}

    public function show(Request $request, $invoice)
    {
        $user = $request->user();

        $transaction = Transaction::with([
    'cashier',
    'customer',
    'details.product',
    'activeReturn',
])
    ->withCount([
        'returnTransactions as blocking_returns_count' => function ($query) {
            $query->whereIn('status', ['pending', 'approved']);
        },
    ])
    ->where('invoice', $invoice)
    ->when(!$user->isAdminUser(), function ($query) use ($user) {
        $query->where('cashier_id', $user->id);
    })
    ->firstOrFail();

        return Inertia::render('Account/Transactions/Show', [
            'transaction' => $transaction,
        ]);
    }
    public function void(Request $request, $invoice)
{
    $user = $request->user();

    try {
        DB::transaction(function () use ($user, $invoice) {
            $transaction = Transaction::with(['details'])
                ->where('invoice', $invoice)
                ->when(!$user->isAdminUser(), function ($query) use ($user) {
                    $query->where('cashier_id', $user->id);
                })
                ->lockForUpdate()
                ->firstOrFail();

            if ($transaction->status === 'voided') {
                throw new DomainException('Transaksi sudah dibatalkan sebelumnya.');
            }

            if ($transaction->status !== 'completed' || $transaction->payment_status !== 'paid') {
                throw new DomainException('Hanya transaksi selesai dan lunas yang bisa di-void.');
            }

            $hasBlockingReturn = $transaction->returnTransactions()
                ->whereIn('status', ['pending', 'approved'])
                ->exists();

            if ($hasBlockingReturn) {
                throw new DomainException('Transaksi yang sudah memiliki retur tidak dapat di-void.');
            }

            if ($transaction->details->isEmpty()) {
                throw new DomainException('Detail transaksi tidak ditemukan.');
            }

            foreach ($transaction->details as $detail) {
                $product = Product::query()
                    ->whereKey($detail->product_id)
                    ->lockForUpdate()
                    ->first();

                if (!$product) {
                    throw new DomainException('Produk pada transaksi tidak ditemukan.');
                }

                $stockBefore = (int) $product->stock;
                $stockAfter = $stockBefore + (int) $detail->qty;

                StockMovement::create([
                    'product_id' => $product->id,
                    'user_id' => $user->id,
                    'type' => 'in',
                    'qty' => $detail->qty,
                    'stock_before' => $stockBefore,
                    'stock_after' => $stockAfter,
                    'reference_type' => Transaction::class,
                    'reference_id' => $transaction->id,
                    'note' => 'Void Transaksi Invoice: ' . $transaction->invoice,
                ]);

                $product->update([
                    'stock' => $stockAfter,
                ]);
            }

            Profit::updateOrCreate(
                [
                    'transaction_id' => $transaction->id,
                ],
                [
                    'total_revenue' => 0,
                    'total_cost' => 0,
                    'profit_amount' => 0,
                ],
            );

            $transaction->update([
                'status' => 'voided',
                'voided_by' => $user->id,
                'voided_at' => now(),
            ]);
        });

        return redirect()
            ->route('account.transactions.show', $invoice)
            ->with('success', 'Transaksi berhasil di-void.');
    } catch (DomainException $exception) {
        return redirect()
            ->route('account.transactions.show', $invoice)
            ->with('error', $exception->getMessage());
    }
}
    protected function createMidtransSnapToken(Transaction $transaction): string
    {
        $transaction->load([
            'customer',
            'details.product',
        ]);

        MidtransConfig::$serverKey = config('midtrans.server_key');
        MidtransConfig::$isProduction = (bool) config('midtrans.is_production', false);
        MidtransConfig::$isSanitized = true;
        MidtransConfig::$is3ds = true;

        $items = $transaction->details->map(function ($detail) {
            return [
                'id' => (string) $detail->product_id,
                'price' => (int) $detail->price,
                'quantity' => (int) $detail->qty,
                'name' => $detail->product?->title ?? 'Produk',
            ];
        })->values()->all();

        if ((int) $transaction->discount > 0) {
            $items[] = [
                'id' => 'DISCOUNT',
                'price' => -1 * (int) $transaction->discount,
                'quantity' => 1,
                'name' => 'Diskon',
            ];
        }

        $customerName = $transaction->customer?->name ?? 'Pelanggan Umum';
        $customerPhone = $transaction->customer?->no_telp ?? null;

        return Snap::getSnapToken([
            'transaction_details' => [
                'order_id' => $transaction->invoice,
                'gross_amount' => (int) $transaction->grand_total,
            ],
            'customer_details' => [
                'first_name' => $customerName,
                'phone' => $customerPhone,
            ],
            'item_details' => $items,
        ]);
    }

    protected function generateTransactionInvoice(): string
    {
        do {
            $invoice = 'TRX-' . now()->format('Ymd') . '-' . strtoupper(substr(bin2hex(random_bytes(3)), 0, 6));
        } while (Transaction::where('invoice', $invoice)->exists());

        return $invoice;
    }
}
