<?php

namespace App\Http\Controllers\Account;

use App\Http\Controllers\Controller;
use App\Models\Category;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str; // <-- 1. PERUBAHAN: Ditambahkan di sini
use Inertia\Inertia;

class CategoryController extends Controller
{
    public function index(Request $request)
    {
        $categories = Category::when($request->q, function ($query) use ($request) {
            $query->where('name', 'like', '%' . $request->q . '%');
        })
            ->latest()
            ->paginate(10);

        $categories->appends([
            'q' => $request->q,
        ]);

        return Inertia::render('Account/Categories/Index', [
            'categories' => $categories,
        ]);
    }

    public function create()
    {
        return Inertia::render('Account/Categories/Create');
    }

    public function store(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255|unique:categories',
            'image' => 'nullable|image|mimes:jpeg,png,jpg|max:2048',
        ]);

        $imageName = null;

        if ($request->hasFile('image')) {
            $image = $request->file('image');
            $image->storeAs('categories', $image->hashName(), 'public');
            $imageName = $image->hashName();
        }

        // <-- 2. PERUBAHAN: Ditambahkan 'slug' di bawah ini
        Category::create([
            'name'  => $request->name,
            'slug'  => Str::slug($request->name, '-'),
            'image' => $imageName,
        ]);

        return redirect()->route('account.categories.index');
    }

    public function edit($id)
    {
        $category = Category::findOrFail($id);

        return Inertia::render('Account/Categories/Edit', [
            'category' => $category,
        ]);
    }

    public function update(Request $request, $id)
    {
        $request->validate([
            'name' => 'required|string|max:255|unique:categories,name,' . $id,
            'image' => 'nullable|image|mimes:jpeg,png,jpg|max:2048',
        ]);

        $category = Category::findOrFail($id);

        if (!$request->hasFile('image')) {
            // <-- 3. PERUBAHAN: Ditambahkan 'slug' saat update tanpa gambar
            $category->update([
                'name' => $request->name,
                'slug' => Str::slug($request->name, '-'),
            ]);
        } else {
            if ($category->image) {
                Storage::disk('public')->delete('categories/' . basename($category->image));
            }

            $image = $request->file('image');
            $image->storeAs('categories', $image->hashName(), 'public');

            // <-- 4. PERUBAHAN: Ditambahkan 'slug' saat update dengan gambar baru
            $category->update([
                'name'  => $request->name,
                'slug'  => Str::slug($request->name, '-'),
                'image' => $image->hashName(),
            ]);
        }

        return redirect()->route('account.categories.index');
    }

    public function destroy($id)
    {
        $category = Category::findOrFail($id);

        if ($category->image) {
            Storage::disk('public')->delete('categories/' . basename($category->image));
        }

        $category->delete();

        return redirect()->route('account.categories.index');
    }
}
