<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Expense extends Model
{
    protected $fillable = [
        'user_id',
        'code',
        'expense_date',
        'category',
        'title',
        'amount',
        'note',
    ];
protected function casts(): array
{
    return [
        'expense_date' => 'date',
        'amount'       => 'integer',
    ];
}
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
