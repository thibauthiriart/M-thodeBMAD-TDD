<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class E2ETestSeeder extends Seeder
{
    /**
     * Seed the E2E test data.
     *
     * Creates a known user for Playwright E2E tests.
     * Uses updateOrCreate so it's safe to run multiple times (non-destructive).
     */
    public function run(): void
    {
        User::updateOrCreate(
            ['email' => 'e2e@test.com'],
            [
                'name' => 'E2E Test User',
                'password' => Hash::make('password'),
                'role' => 'acheteur',
                'email_verified_at' => now(),
            ]
        );
    }
}
