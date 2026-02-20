<?php

use App\Models\User;

// ===========================================================================
// Unauthenticated access — Returns 401
// ===========================================================================

test('unauthenticated request to /api/dashboard returns 401', function () {
    $response = $this->getJson('/api/dashboard');

    $response->assertStatus(401);
});

test('unauthenticated request to /api/seller/dashboard returns 401', function () {
    $response = $this->getJson('/api/seller/dashboard');

    $response->assertStatus(401);
});

test('unauthenticated request to /api/admin/dashboard returns 401', function () {
    $response = $this->getJson('/api/admin/dashboard');

    $response->assertStatus(401);
});

test('unauthenticated request to /api/profile returns 401', function () {
    $response = $this->getJson('/api/profile');

    $response->assertStatus(401);
});

// ===========================================================================
// Acheteur role — Access control
// ===========================================================================

test('acheteur can access /api/dashboard', function () {
    $user = User::factory()->acheteur()->create();

    $response = $this->actingAs($user, 'api')
        ->getJson('/api/dashboard');

    $response->assertStatus(200);
});

test('acheteur can access /api/profile', function () {
    $user = User::factory()->acheteur()->create();

    $response = $this->actingAs($user, 'api')
        ->getJson('/api/profile');

    $response->assertStatus(200);
});

test('acheteur cannot access /api/seller/dashboard — returns 403', function () {
    $user = User::factory()->acheteur()->create();

    $response = $this->actingAs($user, 'api')
        ->getJson('/api/seller/dashboard');

    $response->assertStatus(403)
        ->assertJson([
            'message' => 'Vous n\'avez pas les droits pour accéder à cette ressource.',
        ]);
});

test('acheteur cannot access /api/admin/dashboard — returns 403', function () {
    $user = User::factory()->acheteur()->create();

    $response = $this->actingAs($user, 'api')
        ->getJson('/api/admin/dashboard');

    $response->assertStatus(403)
        ->assertJson([
            'message' => 'Vous n\'avez pas les droits pour accéder à cette ressource.',
        ]);
});

// ===========================================================================
// Vendeur role — Access control
// ===========================================================================

test('vendeur can access /api/dashboard', function () {
    $user = User::factory()->vendeur()->create();

    $response = $this->actingAs($user, 'api')
        ->getJson('/api/dashboard');

    $response->assertStatus(200);
});

test('vendeur can access /api/profile', function () {
    $user = User::factory()->vendeur()->create();

    $response = $this->actingAs($user, 'api')
        ->getJson('/api/profile');

    $response->assertStatus(200);
});

test('vendeur can access /api/seller/dashboard', function () {
    $user = User::factory()->vendeur()->create();

    $response = $this->actingAs($user, 'api')
        ->getJson('/api/seller/dashboard');

    $response->assertStatus(200);
});

test('vendeur cannot access /api/admin/dashboard — returns 403', function () {
    $user = User::factory()->vendeur()->create();

    $response = $this->actingAs($user, 'api')
        ->getJson('/api/admin/dashboard');

    $response->assertStatus(403)
        ->assertJson([
            'message' => 'Vous n\'avez pas les droits pour accéder à cette ressource.',
        ]);
});

// ===========================================================================
// Admin role — Access control
// ===========================================================================

test('admin can access /api/dashboard', function () {
    $user = User::factory()->admin()->create();

    $response = $this->actingAs($user, 'api')
        ->getJson('/api/dashboard');

    $response->assertStatus(200);
});

test('admin can access /api/profile', function () {
    $user = User::factory()->admin()->create();

    $response = $this->actingAs($user, 'api')
        ->getJson('/api/profile');

    $response->assertStatus(200);
});

test('admin can access /api/seller/dashboard', function () {
    $user = User::factory()->admin()->create();

    $response = $this->actingAs($user, 'api')
        ->getJson('/api/seller/dashboard');

    $response->assertStatus(200);
});

test('admin can access /api/admin/dashboard', function () {
    $user = User::factory()->admin()->create();

    $response = $this->actingAs($user, 'api')
        ->getJson('/api/admin/dashboard');

    $response->assertStatus(200);
});
