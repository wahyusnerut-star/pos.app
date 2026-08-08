<?php

namespace App\Http\Controllers\Account;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\Purchase;
use App\Models\PurchaseDetail;
use App\Models\StockMovement;
use App\Models\Supplier;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

class PurchaseController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();

        abort_unless($user->can('purchases.index'), 403);

        $request->validate([
            'q' => 'nullable|string|max:100',
            'supplier_id' => 'nullable|exists:suppliers,id',
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date|after_or_equal:start_date',
        ]);

        $startDate = $request->start_date
            ? Carbon::parse($request->start_date)->startOfDay()
            : Carbon::now()->startOfMonth();

        $endDate = $request->end_date
            ? Carbon::parse($request->end_date)->endOfDay()
            : Carbon::now()->endOfDay();

        $purchases = Purchase::query()
            ->with(['supplier:id,name', 'user:id,name'])
            ->when(!$user->isAdminUser(), function ($query) use ($user) {
                $query->where('user_id', $user->id);
            })
            ->whereBetween('purchase_date', [
                $startDate->toDateString(),
                $endDate->toDateString(),
            ])
            ->when(filled($request->supplier_id), function ($query) use ($request) {
                $query->where('supplier_id', $request->supplier_id);
            })
            ->when(filled($request->q), function ($query) use ($request) {
                $search = trim($request->q);

                $query->where(function ($subQuery) use ($search) {
                    $subQuery->where('invoice', 'like', '%' . $search . '%')
                        ->orWhereHas('supplier', function ($supplierQuery) use ($search) {
                            $supplierQuery->where('name', 'like', '%' . $search . '%');
                        })
                        ->orWhereHas('user', function ($userQuery) use ($search) {
                            $userQuery->where('name', 'like', '%' . $search . '%');
                        });
                });
            })
            ->latest('purchase_date')
            ->latest('id')
            ->paginate(10);

        $purchases->appends([
            'q' => $request->q,
            'supplier_id' => $request->supplier_id,
            'start_date' => $startDate->toDateString(),
            'end_date' => $endDate->toDateString(),
        ]);

        return Inertia::render('Account/Purchases/Index', [
            'purchases' => $purchases,
            'suppliers' => Supplier::query()
                ->orderBy('name')
                ->get(['id', 'name']),
            'filters' => [
                'q' => $request->q ?? '',
                'supplier_id' => $request->supplier_id ?? '',
                'start_date' => $startDate->toDateString(),
                'end_date' => $endDate->toDateString(),
            ],
        ]);
    }

    public function create(Request $request)
    {
        abort_unless($request->user()->can('purchases.create'), 403);

        return Inertia::render('Account/Purchases/Create', [
            'suppliers' => Supplier::query()
                ->where('is_active', true)
                ->orderBy('name')
                ->get(['id', 'name', 'no_telp']),
            'products' => Product::query()
                ->orderBy('title')
                ->get(['id', 'title', 'barcode', 'stock', 'buy_price', 'sell_price', 'unit']),
            'defaultPurchaseDate' => now()->toDateString(),
        ]);
    }

    public function store(Request $request)
    {
        abort_unless($request->user()->can('purchases.create'), 403);

        $request->validate([
            'supplier_id' => 'required|exists:suppliers,id',
            'purchase_date' => 'required|date',
            'note' => 'nullable|string|max:1000',
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|exists:products,id',
            'items.*.qty' => 'required|integer|min:1',
            'items.*.buy_price' => 'required|integer|min:0',
        ]);

        $items = collect($request->items)
            ->map(function ($item) {
                return [
                    'product_id' => (int) $item['product_id'],
                    'qty' => (int) $item['qty'],
                    'buy_price' => (int) $item['buy_price'],
                ];
            })
            ->filter(fn ($item) => $item['product_id'] > 0 && $item['qty'] > 0)
            ->values();

        if ($items->isEmpty()) {
            throw ValidationException::withMessages([
                'items' => 'Tambahkan minimal satu produk untuk pembelian.',
            ]);
        }

        if ($items->pluck('product_id')->unique()->count() !== $items->count()) {
            throw ValidationException::withMessages([
                'items' => 'Produk dalam pembelian tidak boleh duplikat.',
            ]);
        }

        $purchase = DB::transaction(function () use ($request, $items) {
            $lockedProducts = Product::query()
                ->whereIn('id', $items->pluck('product_id')->all())
                ->orderBy('id')
                ->lockForUpdate()
                ->get()
                ->keyBy('id');

            $purchase = Purchase::create([
                'supplier_id' => (int) $request->supplier_id,
                'user_id' => $request->user()->id,
                'invoice' => $this->generatePurchaseInvoice(),
                'purchase_date' => $request->purchase_date,
                'total_items' => $items->count(),
                'total_qty' => $items->sum('qty'),
                'total_amount' => $items->sum(fn ($item) => $item['qty'] * $item['buy_price']),
                'note' => filled($request->note) ? trim($request->note) : null,
            ]);

            foreach ($items as $item) {
                $product = $lockedProducts->get($item['product_id']);

                if (!$product) {
                    throw ValidationException::withMessages([
                        'items' => 'Terdapat produk yang tidak valid pada pembelian.',
                    ]);
                }

                if ($item['buy_price'] > (int) $product->sell_price) {
                    throw ValidationException::withMessages([
                        'items' => 'Harga beli untuk produk "' . $product->title . '" tidak boleh lebih tinggi dari harga jual.',
                    ]);
                }


                $stockBefore = (int) $product->stock;
                $stockAfter = $stockBefore + $item['qty'];
                $subtotal = $item['qty'] * $item['buy_price'];

                PurchaseDetail::create([
                    'purchase_id' => $purchase->id,
                    'product_id' => $product->id,
                    'qty' => $item['qty'],
                    'buy_price' => $item['buy_price'],
                    'subtotal' => $subtotal,
                ]);

                $product->update([
                    'stock' => $stockAfter,
                    'buy_price' => $item['buy_price'],
                ]);

                StockMovement::create([
                    'product_id' => $product->id,
                    'user_id' => $request->user()->id,
                    'type' => 'in',
                    'qty' => $item['qty'],
                    'stock_before' => $stockBefore,
                    'stock_after' => $stockAfter,
                    'reference_type' => Purchase::class,
                    'reference_id' => $purchase->id,
                    'note' => 'Pembelian Invoice: ' . $purchase->invoice,
                ]);
            }

            return $purchase;
        });

        return redirect()
            ->route('account.purchases.show', $purchase->invoice)
            ->with('success', 'Pembelian berhasil disimpan dan stok produk sudah diperbarui.');
    }

    public function show(Request $request, $invoice)
    {
        $user = $request->user();

        abort_unless($user->can('purchases.show'), 403);

        $purchase = Purchase::query()
            ->with([
                'supplier:id,name,no_telp,email,address',
                'user:id,name',
                'details.product:id,title,barcode,unit',
            ])
            ->where('invoice', $invoice)
            ->when(!$user->isAdminUser(), function ($query) use ($user) {
                $query->where('user_id', $user->id);
            })
            ->firstOrFail();

        return Inertia::render('Account/Purchases/Show', [
            'purchase' => $purchase,
        ]);
    }

    protected function generatePurchaseInvoice(): string
    {
        do {
            $invoice = 'PUR-' . now()->format('Ymd') . '-' . strtoupper(substr(bin2hex(random_bytes(3)), 0, 6));
        } while (Purchase::where('invoice', $invoice)->exists());

        return $invoice;
    }
}
