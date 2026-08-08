<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Str;

class Product extends Model
{

    protected function casts(): array
    {
        return [
            'buy_price'  => 'integer',
            'sell_price' => 'integer',
            'stock'      => 'integer',
            'is_active'  => 'boolean',
        ];
    }

    protected $fillable = [
        'category_id',
        'image',
        'barcode',
        'title',
        'slug',
        'description',
        'buy_price',
        'sell_price',
        'unit',
        'stock',
        'is_active',
    ];

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function carts(): HasMany
    {
        return $this->hasMany(Cart::class);
    }

    public function transactionDetails(): HasMany
    {
        return $this->hasMany(TransactionDetail::class);
    }

    public function purchaseDetails(): HasMany
    {
        return $this->hasMany(PurchaseDetail::class);
    }

    public function stockOpnameDetails(): HasMany
    {
        return $this->hasMany(StockOpnameDetail::class);
    }

    public function stockMovements(): HasMany
    {
        return $this->hasMany(StockMovement::class);
    }

    public function latestStockMovement(): HasOne
    {
        return $this->hasOne(StockMovement::class)->latestOfMany();
    }

    protected function image(): Attribute
    {
        return Attribute::make(
            get: fn($image) => $image
                ? asset('/storage/products/' . $image)
                : null,
        );
    }

    protected static function booted(): void
    {
        static::creating(function (Product $product) {
            if (empty($product->slug)) {
                $product->slug = Str::slug($product->title);
            }
        });

        static::updating(function (Product $product) {
            if ($product->isDirty('title') && ! $product->isDirty('slug')) {
                $product->slug = Str::slug($product->title);
            }
        });
    }
}
