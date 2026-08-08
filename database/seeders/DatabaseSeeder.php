<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // 1. Seed permissions
        $this->call(PermissionsTableSeeder::class);

        // 2. Seed roles + assign permissions
        $this->call(RolesTableSeeder::class);

        // 3. Seed users + assign roles
        $this->call(UserTableSeeder::class);
    }
}
