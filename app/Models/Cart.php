<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Cart extends Model
{

    protected function casts(): array
    {
        return [
            'qty'   => 'integer',
            'price' => 'integer',
        ];
    }

    protected $fillable = [
        'cashier_id',
        'product_id',
        'qty',
        'price',
    ];

    public function cashier(): BelongsTo
    {
        return $this->belongsTo(User::class, 'cashier_id');
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
