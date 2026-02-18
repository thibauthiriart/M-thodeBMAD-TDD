<?php

use App\Models\User;

// ===========================================================================
// AC1 — Happy path: Get profile
// ===========================================================================

test('authenticated user can view their profile', function () {
    $user = User::factory()->create([
        'name' => 'Jean Dupont',
        'email' => 'jean@example.com',
        'role' => 'acheteur',
    ]);

    $response = $this->actingAs($user, 'api')
        ->getJson('/api/profile');

    $response->assertStatus(200)
        ->assertJsonStructure([
            'data' => ['id', 'name', 'email', 'role', 'created_at', 'updated_at'],
        ])
        ->assertJsonPath('data.name', 'Jean Dupont')
        ->assertJsonPath('data.email', 'jean@example.com')
        ->assertJsonPath('data.role', 'acheteur');
});

test('profile response uses UserResource format', function () {
    $user = User::factory()->create([
        'name' => 'Marie Martin',
        'email' => 'marie@example.com',
        'role' => 'vendeur',
    ]);

    $response = $this->actingAs($user, 'api')
        ->getJson('/api/profile');

    $response->assertStatus(200)
        ->assertJsonStructure([
            'data' => ['id', 'name', 'email', 'role', 'created_at', 'updated_at'],
        ]);

    // Ensure no password or sensitive fields are exposed
    $data = $response->json('data');
    expect($data)->not->toHaveKey('password');
    expect($data)->not->toHaveKey('remember_token');
});

test('profile returns correct data for vendeur role', function () {
    $user = User::factory()->create([
        'name' => 'Vendeur Test',
        'email' => 'vendeur@example.com',
        'role' => 'vendeur',
    ]);

    $response = $this->actingAs($user, 'api')
        ->getJson('/api/profile');

    $response->assertStatus(200)
        ->assertJsonPath('data.role', 'vendeur')
        ->assertJsonPath('data.name', 'Vendeur Test');
});

test('profile returns correct data for acheteur role', function () {
    $user = User::factory()->create([
        'name' => 'Acheteur Test',
        'email' => 'acheteur@example.com',
        'role' => 'acheteur',
    ]);

    $response = $this->actingAs($user, 'api')
        ->getJson('/api/profile');

    $response->assertStatus(200)
        ->assertJsonPath('data.role', 'acheteur')
        ->assertJsonPath('data.name', 'Acheteur Test');
});

// ===========================================================================
// Security — Unauthenticated access
// ===========================================================================

test('unauthenticated user cannot access profile', function () {
    $response = $this->getJson('/api/profile');

    $response->assertStatus(401);
});
