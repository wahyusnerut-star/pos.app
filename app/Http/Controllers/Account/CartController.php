<?php

namespace App\Http\Controllers\Account;

use App\Http\Controllers\Controller;
use App\Models\Cart;
use App\Models\Product;
use Illuminate\Http\Request;

class CartController extends Controller
{
    public function store(Request $request)
    {
        $request->validate([
            'product_id' => 'required|exists:products,id',
        ]);

        $user = $request->user();

        if (!$user->activeCashierShift) {
            return back()->with('error', 'Buka shift kasir terlebih dahulu sebelum menambah produk.');
        }

        $product = Product::query()
            ->where('id', $request->product_id)
            ->where('is_active', true)
            ->firstOrFail();

        if ($product->stock < 1) {
            return back()->with('error', 'Stok produk habis.');
        }

        $cart = Cart::firstOrNew([
            'cashier_id' => $user->id,
            'product_id' => $product->id,
        ]);

        $nextQty = (int) $cart->qty + 1;

        if ($nextQty > $product->stock) {
            return back()->with('error', 'Qty keranjang melebihi stok tersedia.');
        }

        $cart->fill([
            'qty'   => $nextQty,
            'price' => $product->sell_price,
        ])->save();

        return back();
    }

    public function update(Request $request, Cart $cart)
    {
        $request->validate([
            'qty' => 'required|integer|min:1',
        ]);

        $this->authorizeCartOwner($request, $cart);

        $product = Product::findOrFail($cart->product_id);
        $qty = (int) $request->qty;

        if ($qty > $product->stock) {
            return back()->with('error', 'Qty keranjang melebihi stok tersedia.');
        }

        $cart->update([
            'qty'   => $qty,
            'price' => $product->sell_price,
        ]);

        return back();
    }

    public function destroy(Request $request, Cart $cart)
    {
        $this->authorizeCartOwner($request, $cart);

        $cart->delete();

        return back();
    }

    protected function authorizeCartOwner(Request $request, Cart $cart): void
    {
        if ($cart->cashier_id !== $request->user()->id) {
            abort(403);
        }
    }
}
