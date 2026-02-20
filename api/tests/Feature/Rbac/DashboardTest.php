<?php

use App\Models\User;

// ===========================================================================
// General Dashboard — /api/dashboard
// ===========================================================================

test('dashboard returns user data for authenticated user', function () {
    $user = User::factory()->acheteur()->create([
        'name' => 'Test Buyer',
        'email' => 'buyer@example.com',
    ]);

    $response = $this->actingAs($user, 'api')
        ->getJson('/api/dashboard');

    $response->assertStatus(200)
        ->assertJsonStructure([
            'data' => [
                'user' => ['id', 'name', 'email', 'role'],
            ],
        ])
        ->assertJsonPath('data.user.email', 'buyer@example.com')
        ->assertJsonPath('data.user.role', 'acheteur');
});

test('dashboard returns correct role for vendeur', function () {
    $user = User::factory()->vendeur()->create();

    $response = $this->actingAs($user, 'api')
        ->getJson('/api/dashboard');

    $response->assertStatus(200)
        ->assertJsonPath('data.user.role', 'vendeur');
});

test('dashboard returns correct role for admin', function () {
    $user = User::factory()->admin()->create();

    $response = $this->actingAs($user, 'api')
        ->getJson('/api/dashboard');

    $response->assertStatus(200)
        ->assertJsonPath('data.user.role', 'admin');
});

// ===========================================================================
// Seller Dashboard — /api/seller/dashboard
// ===========================================================================

test('seller dashboard returns stats and products for vendeur', function () {
    $user = User::factory()->vendeur()->create();

    $response = $this->actingAs($user, 'api')
        ->getJson('/api/seller/dashboard');

    $response->assertStatus(200)
        ->assertJsonStructure([
            'data' => [
                'stats' => ['total_products', 'total_orders', 'revenue'],
                'products',
            ],
        ]);
});

test('seller dashboard returns stats and products for admin', function () {
    $user = User::factory()->admin()->create();

    $response = $this->actingAs($user, 'api')
        ->getJson('/api/seller/dashboard');

    $response->assertStatus(200)
        ->assertJsonStructure([
            'data' => [
                'stats' => ['total_products', 'total_orders', 'revenue'],
                'products',
            ],
        ]);
});

// ===========================================================================
// Admin Dashboard — /api/admin/dashboard
// ===========================================================================

test('admin dashboard returns stats and users', function () {
    // Create some users of each role
    User::factory()->acheteur()->count(2)->create();
    User::factory()->vendeur()->count(1)->create();
    $admin = User::factory()->admin()->create();

    $response = $this->actingAs($admin, 'api')
        ->getJson('/api/admin/dashboard');

    $response->assertStatus(200)
        ->assertJsonStructure([
            'data' => [
                'stats' => ['total_users', 'total_sellers', 'total_buyers', 'total_admins'],
                'users',
            ],
        ]);

    // Stats should reflect actual counts
    $stats = $response->json('data.stats');
    expect($stats['total_users'])->toBeGreaterThanOrEqual(4);
    expect($stats['total_buyers'])->toBeGreaterThanOrEqual(2);
    expect($stats['total_sellers'])->toBeGreaterThanOrEqual(1);
    expect($stats['total_admins'])->toBeGreaterThanOrEqual(1);
});

test('admin dashboard users list contains user data', function () {
    $admin = User::factory()->admin()->create([
        'name' => 'Admin User',
        'email' => 'admin-dash@example.com',
    ]);

    $response = $this->actingAs($admin, 'api')
        ->getJson('/api/admin/dashboard');

    $response->assertStatus(200);

    $users = $response->json('data.users');
    expect($users)->toBeArray();
    expect(count($users))->toBeGreaterThanOrEqual(1);

    // Each user in the list should have expected fields
    $firstUser = $users[0];
    expect($firstUser)->toHaveKeys(['id', 'name', 'email', 'role', 'created_at']);
});
