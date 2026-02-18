<?php

use App\Models\User;
use Laravel\Passport\Passport;

// ===========================================================================
// AC3 — Logout: Token revocation
// ===========================================================================

test('logout revokes the current user token', function () {
    $user = User::factory()->create([
        'email' => 'logout-test@example.com',
        'role' => 'acheteur',
    ]);

    // Login to get a real token
    $loginResponse = $this->postJson('/api/auth/login', [
        'email' => 'logout-test@example.com',
        'password' => 'password',
    ]);

    $loginResponse->assertStatus(200);
    $token = $loginResponse->json('data.token');

    // Verify token was created in DB
    $this->assertDatabaseHas('oauth_access_tokens', [
        'user_id' => $user->id,
        'revoked' => false,
    ]);

    // Logout with the real token
    $response = $this->withHeaders([
        'Authorization' => 'Bearer ' . $token,
    ])->postJson('/api/auth/logout');

    $response->assertStatus(200)
        ->assertJsonPath('message', 'Déconnexion réussie.');

    // Verify the token was revoked in the database
    $this->assertDatabaseHas('oauth_access_tokens', [
        'user_id' => $user->id,
        'revoked' => true,
    ]);
});

test('logout returns 401 for unauthenticated user', function () {
    $response = $this->postJson('/api/auth/logout');

    $response->assertStatus(401);
});

test('logout only revokes the current token, not all user tokens', function () {
    $user = User::factory()->create([
        'email' => 'logout-multi@example.com',
        'role' => 'vendeur',
    ]);

    // Login twice to get two tokens
    $loginResponse1 = $this->postJson('/api/auth/login', [
        'email' => 'logout-multi@example.com',
        'password' => 'password',
    ]);
    $token1 = $loginResponse1->json('data.token');

    $loginResponse2 = $this->postJson('/api/auth/login', [
        'email' => 'logout-multi@example.com',
        'password' => 'password',
    ]);
    $token2 = $loginResponse2->json('data.token');

    // Should have 2 non-revoked tokens
    $nonRevokedBefore = \DB::table('oauth_access_tokens')
        ->where('user_id', $user->id)
        ->where('revoked', false)
        ->count();
    expect($nonRevokedBefore)->toBe(2);

    // Logout with token1
    $response = $this->withHeaders([
        'Authorization' => 'Bearer ' . $token1,
    ])->postJson('/api/auth/logout');

    $response->assertStatus(200);

    // One token revoked, one still active
    $revokedCount = \DB::table('oauth_access_tokens')
        ->where('user_id', $user->id)
        ->where('revoked', true)
        ->count();

    $nonRevokedCount = \DB::table('oauth_access_tokens')
        ->where('user_id', $user->id)
        ->where('revoked', false)
        ->count();

    expect($revokedCount)->toBe(1);
    expect($nonRevokedCount)->toBe(1);
});

test('logout response has correct structure', function () {
    $user = User::factory()->create([
        'email' => 'logout-struct@example.com',
        'role' => 'acheteur',
    ]);

    Passport::actingAs($user);

    $response = $this->postJson('/api/auth/logout');

    $response->assertStatus(200)
        ->assertJsonStructure(['message']);
});
