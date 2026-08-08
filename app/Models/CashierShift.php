<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CashierShift extends Model
{
    protected function casts(): array
    {
        return [
            'opened_at'          => 'datetime',
            'closed_at'          => 'datetime',
            'cash_in_hand'       => 'integer',
            'expected_cash'      => 'integer',
            'actual_cash'        => 'integer',
            'difference'         => 'integer',
            'total_transactions' => 'integer',
        ];
    }

    protected $fillable = [
        'user_id',
        'opened_at',
        'closed_at',
        'cash_in_hand',
        'expected_cash',
        'actual_cash',
        'difference',
        'total_transactions',
        'note',
        'status',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function isOpen(): bool
    {
        return $this->status === 'open' && $this->closed_at === null;
    }
}
