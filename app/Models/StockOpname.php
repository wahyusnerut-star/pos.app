<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class StockOpname extends Model
{
    protected $fillable = [
        'user_id',
        'code',
        'opname_date',
        'total_items',
        'total_difference_qty',
        'note',
    ];
protected function casts(): array
{
    return [
        'opname_date'          => 'date',
        'total_items'          => 'integer',
        'total_difference_qty' => 'integer',
    ];
}
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function details(): HasMany
    {
        return $this->hasMany(StockOpnameDetail::class);
    }
}
