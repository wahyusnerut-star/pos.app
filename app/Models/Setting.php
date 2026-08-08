<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Setting extends Model
{
    protected $fillable = [
        'key',
        'value',
        'group',
    ];
    public static function storeSettings(): array
{
    $settings = static::query()
        ->where('group', 'store')
        ->pluck('value', 'key');

    $logo = $settings->get('store.logo');

    return [
        'name'     => $settings->get('store.name') ?: 'DC AL-RIFA IE',
        'address'  => $settings->get('store.address') ?: 'Jl. Raya Ketawang No. 2, Gondanglegi, Malang',
        'phone'    => $settings->get('store.phone') ?: '0838-3597-7968',
        'email'    => $settings->get('store.email') ?: 'dc.karf2@gmail.com',
        'logo'     => $logo,
        'logo_url' => 'https://www.instagram.com/karf.mart?igsh=Nzc4bzFuaXI0Ymxr'
    ];
}
}
