<?php

namespace App\Http\Controllers\Account;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\Product;
use App\Models\StockMovement;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;

class ProductController extends Controller
{
    public function index(Request $request)
    {
        $products = Product::with('category')
            ->when($request->q, function ($query) use ($request) {
                $query->where('title', 'like', '%' . $request->q . '%')
                    ->orWhere('barcode', 'like', '%' . $request->q . '%');
            })
            ->latest()
            ->paginate(10);

        $products->appends([
            'q' => $request->q,
        ]);

        return Inertia::render('Account/Products/Index', [
            'products' => $products,
        ]);
    }

    public function create()
    {
        return Inertia::render('Account/Products/Create', [
            'categories' => Category::orderBy('name')->get(),
        ]);
    }

    public function store(Request $request)
    {
        $request->validate([
            'category_id' => 'required|exists:categories,id',
            'image'       => 'nullable|image|mimes:jpeg,png,jpg|max:2048',
            'barcode'     => 'required|string|unique:products,barcode', // FIX: Menghapus koma menggantung di ujung
            'title'       => 'required|string|max:255',
            'description' => 'nullable|string',
            'buy_price'   => 'required|numeric|min:0',
            'sell_price'  => 'required|numeric|min:0|gte:buy_price',
            'unit'        => 'required|string|max:20',
            'stock'       => 'required|integer|min:0',
        ], [
            'sell_price.gte' => 'Harga jual tidak boleh lebih rendah dari harga beli.',
        ]);

        // FIX: Inisialisasi nama gambar dengan null (jika user tidak upload gambar)
        $imageName = null;

        // FIX: Tambahkan pengaman mengecek apakah ada file gambar yang diunggah sebelum storeAs dijalankan
        if ($request->hasFile('image')) {
            $image = $request->file('image');
            $imageName = $image->hashName();
            $image->storeAs('products', $imageName, 'public');
        }

        // FIX: Pindahkan seluruh proses pembuatan instans data ke dalam DB Transaction
        DB::transaction(function () use ($request, $imageName) {
            $product = Product::create([
                'category_id' => $request->category_id,
                'image'       => $imageName, // Menggunakan variabel nama gambar yang dinamis
                'barcode'     => $request->barcode,
                'title'       => $request->title,
                'description' => $request->description,
                'buy_price'   => $request->buy_price,
                'sell_price'  => $request->sell_price,
                'unit'        => $request->unit,
                'stock'       => $request->stock,
                'is_active'   => true,
            ]);

            if ((int) $request->stock > 0) {
                StockMovement::create([
                    'product_id'     => $product->id,
                    'user_id'        => $request->user()->id,
                    'type'           => 'in',
                    'qty'            => (int) $request->stock,
                    'stock_before'   => 0,
                    'stock_after'    => (int) $request->stock,
                    'reference_type' => null,
                    'reference_id'   => null,
                    'note'           => 'Stok awal produk saat dibuat.',
                ]);
            }
        });

        return redirect()->route('account.products.index');
    }

    public function edit($id)
    {
        return Inertia::render('Account/Products/Edit', [
            'product'    => Product::findOrFail($id),
            'categories' => Category::orderBy('name')->get(),
        ]);
    }

    public function update(Request $request, $id)
    {
        $request->validate([
            'category_id' => 'required|exists:categories,id',
            'image'       => 'nullable|image|mimes:jpeg,png,jpg|max:2048',
            'barcode'     => 'required|string|unique:products,barcode,' . $id,
            'title'       => 'required|string|max:255',
            'description' => 'nullable|string',
            'buy_price'   => 'required|numeric|min:0',
            'sell_price'  => 'required|numeric|min:0|gte:buy_price', // TIPS: Tambahkan gte di fungsi update juga jika diperlukan
            'unit'        => 'required|string|max:20',
        ], [
            'sell_price.gte' => 'Harga jual tidak boleh lebih rendah dari harga beli.',
        ]);

        $product = Product::findOrFail($id);

        $data = [
            'category_id' => $request->category_id,
            'barcode'     => $request->barcode,
            'title'       => $request->title,
            'description' => $request->description,
            'buy_price'   => $request->buy_price,
            'sell_price'  => $request->sell_price,
            'unit'        => $request->unit,
        ];

        if ($request->hasFile('image')) {
            // Hapus gambar lama jika ada sebelum diganti yang baru
            if ($product->image) {
                Storage::disk('public')->delete('products/' . basename($product->image));
            }

            $image = $request->file('image');
            $image->storeAs('products', $image->hashName(), 'public');

            $data['image'] = $image->hashName();
        }

        $product->update($data);

        return redirect()->route('account.products.index');
    }

    public function destroy($id)
    {
        $product = Product::findOrFail($id);

        if ($product->image) {
            Storage::disk('public')->delete('products/' . basename($product->image));
        }

        $product->delete();

        return redirect()->route('account.products.index');
    }

    public function printBarcodes(Request $request)
    {
        $request->validate([
            'product_ids'   => 'required|array',
            'product_ids.*' => 'exists:products,id',
        ]);

        $products = Product::whereIn('id', $request->product_ids)->get();

        return view('print.barcode', compact('products'));
    }
}
