<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PurchaseDetail extends Model
{
    protected $fillable = [
        'purchase_id',
        'product_id',
        'qty',
        'buy_price',
        'subtotal',
    ];
protected function casts(): array
{
    return [
        'qty'       => 'integer',
        'buy_price' => 'integer',
        'subtotal'  => 'integer',
    ];
}
    public function purchase(): BelongsTo
    {
        return $this->belongsTo(Purchase::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function supplierReturnDetails(): HasMany
    {
        return $this->hasMany(SupplierReturnDetail::class);
    }
}
