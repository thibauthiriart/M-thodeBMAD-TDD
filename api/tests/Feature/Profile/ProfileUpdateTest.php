<?php

use App\Models\User;

// ===========================================================================
// AC2 — Happy path: Update profile
// ===========================================================================

test('authenticated user can update their name', function () {
    $user = User::factory()->create([
        'name' => 'Ancien Nom',
        'email' => 'update-test@example.com',
        'role' => 'acheteur',
    ]);

    $response = $this->actingAs($user, 'api')
        ->putJson('/api/profile', [
            'name' => 'Nouveau Nom',
        ]);

    $response->assertStatus(200)
        ->assertJsonPath('data.name', 'Nouveau Nom')
        ->assertJsonPath('data.email', 'update-test@example.com');

    // Verify database was updated
    $this->assertDatabaseHas('users', [
        'id' => $user->id,
        'name' => 'Nouveau Nom',
    ]);
});

test('profile update does not change email', function () {
    $user = User::factory()->create([
        'name' => 'Test User',
        'email' => 'no-change-email@example.com',
        'role' => 'acheteur',
    ]);

    $response = $this->actingAs($user, 'api')
        ->putJson('/api/profile', [
            'name' => 'Nouveau Nom',
            'email' => 'hacker@evil.com', // should be ignored
        ]);

    $response->assertStatus(200)
        ->assertJsonPath('data.email', 'no-change-email@example.com');

    // Email must remain unchanged in DB
    $this->assertDatabaseHas('users', [
        'id' => $user->id,
        'email' => 'no-change-email@example.com',
    ]);
});

test('profile update does not change role', function () {
    $user = User::factory()->create([
        'name' => 'Test User',
        'email' => 'no-change-role@example.com',
        'role' => 'acheteur',
    ]);

    $response = $this->actingAs($user, 'api')
        ->putJson('/api/profile', [
            'name' => 'Nouveau Nom',
            'role' => 'admin', // should be ignored
        ]);

    $response->assertStatus(200)
        ->assertJsonPath('data.role', 'acheteur');

    // Role must remain unchanged in DB
    $this->assertDatabaseHas('users', [
        'id' => $user->id,
        'role' => 'acheteur',
    ]);
});

test('profile update returns UserResource format', function () {
    $user = User::factory()->create([
        'name' => 'Resource Test',
        'email' => 'resource@example.com',
        'role' => 'vendeur',
    ]);

    $response = $this->actingAs($user, 'api')
        ->putJson('/api/profile', [
            'name' => 'Updated Name',
        ]);

    $response->assertStatus(200)
        ->assertJsonStructure([
            'data' => ['id', 'name', 'email', 'role', 'created_at', 'updated_at'],
        ]);

    // Ensure no password or sensitive fields
    $data = $response->json('data');
    expect($data)->not->toHaveKey('password');
    expect($data)->not->toHaveKey('remember_token');
});

// ===========================================================================
// Validation — Name required
// ===========================================================================

test('profile update with empty name returns validation error', function () {
    $user = User::factory()->create([
        'name' => 'Original Name',
        'email' => 'empty-name@example.com',
        'role' => 'acheteur',
    ]);

    $response = $this->actingAs($user, 'api')
        ->putJson('/api/profile', [
            'name' => '',
        ]);

    $response->assertStatus(422)
        ->assertJsonValidationErrors(['name']);

    // Name should not change in DB
    $this->assertDatabaseHas('users', [
        'id' => $user->id,
        'name' => 'Original Name',
    ]);
});

test('profile update with missing name returns validation error', function () {
    $user = User::factory()->create([
        'name' => 'Original Name',
        'email' => 'missing-name@example.com',
        'role' => 'acheteur',
    ]);

    $response = $this->actingAs($user, 'api')
        ->putJson('/api/profile', []);

    $response->assertStatus(422)
        ->assertJsonValidationErrors(['name']);

    // Name should not change in DB
    $this->assertDatabaseHas('users', [
        'id' => $user->id,
        'name' => 'Original Name',
    ]);
});

test('profile update with whitespace-only name returns validation error', function () {
    $user = User::factory()->create([
        'name' => 'Original Name',
        'email' => 'spaces-name@example.com',
        'role' => 'acheteur',
    ]);

    $response = $this->actingAs($user, 'api')
        ->putJson('/api/profile', [
            'name' => '   ',
        ]);

    $response->assertStatus(422)
        ->assertJsonValidationErrors(['name']);

    // Name should not change in DB
    $this->assertDatabaseHas('users', [
        'id' => $user->id,
        'name' => 'Original Name',
    ]);
});

test('profile update with very long name returns validation error', function () {
    $user = User::factory()->create([
        'name' => 'Original Name',
        'email' => 'long-name@example.com',
        'role' => 'acheteur',
    ]);

    $response = $this->actingAs($user, 'api')
        ->putJson('/api/profile', [
            'name' => str_repeat('a', 256),
        ]);

    $response->assertStatus(422)
        ->assertJsonValidationErrors(['name']);
});

// ===========================================================================
// Validation — Error messages in French
// ===========================================================================

test('validation error messages are in French', function () {
    $user = User::factory()->create([
        'name' => 'Test User',
        'email' => 'french-msg@example.com',
        'role' => 'acheteur',
    ]);

    $response = $this->actingAs($user, 'api')
        ->putJson('/api/profile', [
            'name' => '',
        ]);

    $response->assertStatus(422);

    $errors = $response->json('errors.name');
    expect(implode(' ', $errors))->toContain('nom');
});

// ===========================================================================
// Security — Unauthenticated access
// ===========================================================================

test('unauthenticated user cannot update profile', function () {
    $response = $this->putJson('/api/profile', [
        'name' => 'Hacker',
    ]);

    $response->assertStatus(401);
});

// ===========================================================================
// Name trimming
// ===========================================================================

test('name is trimmed before saving', function () {
    $user = User::factory()->create([
        'name' => 'Original',
        'email' => 'trim@example.com',
        'role' => 'acheteur',
    ]);

    $response = $this->actingAs($user, 'api')
        ->putJson('/api/profile', [
            'name' => '  Trimmed Name  ',
        ]);

    $response->assertStatus(200)
        ->assertJsonPath('data.name', 'Trimmed Name');

    $this->assertDatabaseHas('users', [
        'id' => $user->id,
        'name' => 'Trimmed Name',
    ]);
});
