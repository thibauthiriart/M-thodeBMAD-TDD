<?php

use App\Models\User;

// ===========================================================================
// AC1 — Happy path: Successful login
// ===========================================================================

test('login with valid credentials returns user and token', function () {
    $user = User::factory()->create([
        'email' => 'login-test@example.com',
        'role' => 'acheteur',
    ]);

    $response = $this->postJson('/api/auth/login', [
        'email' => 'login-test@example.com',
        'password' => 'password', // UserFactory uses Hash::make('password')
    ]);

    $response->assertStatus(200)
        ->assertJsonStructure([
            'data' => [
                'user' => ['id', 'name', 'email', 'role', 'created_at', 'updated_at'],
                'token',
            ],
        ])
        ->assertJsonPath('data.user.email', 'login-test@example.com')
        ->assertJsonPath('data.user.role', 'acheteur');

    // Token was returned
    expect($response->json('data.token'))->toBeString()->not->toBeEmpty();
});

test('login creates a Passport access token in the database', function () {
    $user = User::factory()->create([
        'email' => 'login-token@example.com',
        'role' => 'vendeur',
    ]);

    $response = $this->postJson('/api/auth/login', [
        'email' => 'login-token@example.com',
        'password' => 'password',
    ]);

    $response->assertStatus(200);

    // Verify token exists in oauth_access_tokens table
    $this->assertDatabaseHas('oauth_access_tokens', [
        'user_id' => $user->id,
        'revoked' => false,
    ]);
});

test('login token has an expiration date set (NFR8)', function () {
    $user = User::factory()->create([
        'email' => 'login-expiry@example.com',
        'role' => 'acheteur',
    ]);

    $response = $this->postJson('/api/auth/login', [
        'email' => 'login-expiry@example.com',
        'password' => 'password',
    ]);

    $response->assertStatus(200);

    // Get the latest token for this user
    $token = \DB::table('oauth_access_tokens')
        ->where('user_id', $user->id)
        ->orderBy('created_at', 'desc')
        ->first();

    expect($token)->not->toBeNull();
    expect($token->expires_at)->not->toBeNull();

    // Expiry should be in the future
    $expiresAt = new \DateTime($token->expires_at);
    expect($expiresAt->getTimestamp())->toBeGreaterThan(time());
});

test('login response does not expose password', function () {
    User::factory()->create([
        'email' => 'login-nopwd@example.com',
        'role' => 'acheteur',
    ]);

    $response = $this->postJson('/api/auth/login', [
        'email' => 'login-nopwd@example.com',
        'password' => 'password',
    ]);

    $response->assertStatus(200);

    $userData = $response->json('data.user');
    expect($userData)->not->toHaveKey('password');
    expect($userData)->not->toHaveKey('remember_token');
});

// ===========================================================================
// AC2 — Invalid credentials (generic error, no field reveal)
// ===========================================================================

test('login with wrong password returns generic error message', function () {
    User::factory()->create([
        'email' => 'login-wrongpwd@example.com',
        'role' => 'acheteur',
    ]);

    $response = $this->postJson('/api/auth/login', [
        'email' => 'login-wrongpwd@example.com',
        'password' => 'definitelywrongpassword',
    ]);

    $response->assertStatus(422)
        ->assertJsonValidationErrors(['email']);

    // Error message should be generic (no "wrong password" hint)
    $errors = $response->json('errors.email');
    expect(implode(' ', $errors))->toContain('identifiants');
    expect(implode(' ', $errors))->not->toContain('mot de passe');
});

test('login with non-existent email returns same generic error (prevents enumeration)', function () {
    $response = $this->postJson('/api/auth/login', [
        'email' => 'nonexistent@example.com',
        'password' => 'SomePassword123',
    ]);

    $response->assertStatus(422)
        ->assertJsonValidationErrors(['email']);

    // Error message should NOT reveal that email doesn't exist
    $errors = $response->json('errors.email');
    expect(implode(' ', $errors))->toContain('identifiants');
    expect(implode(' ', $errors))->not->toContain('introuvable');
    expect(implode(' ', $errors))->not->toContain('not found');
});

test('error messages for wrong email vs wrong password are identical', function () {
    User::factory()->create([
        'email' => 'existing@example.com',
        'role' => 'acheteur',
    ]);

    // Attempt 1: non-existent email
    $response1 = $this->postJson('/api/auth/login', [
        'email' => 'nonexistent-user@example.com',
        'password' => 'wrongpassword',
    ]);

    // Attempt 2: existing email, wrong password
    $response2 = $this->postJson('/api/auth/login', [
        'email' => 'existing@example.com',
        'password' => 'wrongpassword',
    ]);

    $response1->assertStatus(422);
    $response2->assertStatus(422);

    // Same error message for both cases (anti-enumeration)
    $error1 = $response1->json('errors.email.0');
    $error2 = $response2->json('errors.email.0');
    expect($error1)->toBe($error2);
});

// ===========================================================================
// Validation — Missing fields
// ===========================================================================

test('login with missing email returns validation error', function () {
    $response = $this->postJson('/api/auth/login', [
        'password' => 'SomePassword123',
    ]);

    $response->assertStatus(422)
        ->assertJsonValidationErrors(['email']);
});

test('login with missing password returns validation error', function () {
    $response = $this->postJson('/api/auth/login', [
        'email' => 'test@example.com',
    ]);

    $response->assertStatus(422)
        ->assertJsonValidationErrors(['password']);
});

test('login with empty body returns validation errors', function () {
    $response = $this->postJson('/api/auth/login', []);

    $response->assertStatus(422)
        ->assertJsonValidationErrors(['email', 'password']);
});

test('login with invalid email format returns validation error', function () {
    $response = $this->postJson('/api/auth/login', [
        'email' => 'not-an-email',
        'password' => 'SomePassword123',
    ]);

    $response->assertStatus(422)
        ->assertJsonValidationErrors(['email']);
});
