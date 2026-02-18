<?php

use App\Models\User;

// ===========================================================================
// AC1 — Happy path: Successful registration
// ===========================================================================

test('register as acheteur creates user with correct role, hashed password, and returns token', function () {
    $response = $this->postJson('/api/register', [
        'email' => 'test-acheteur@example.com',
        'password' => 'SecureP@ss123',
        'password_confirmation' => 'SecureP@ss123',
        'role' => 'acheteur',
    ]);

    $response->assertStatus(201)
        ->assertJsonStructure([
            'data' => [
                'user' => ['id', 'name', 'email', 'role', 'created_at', 'updated_at'],
                'token',
            ],
        ])
        ->assertJsonPath('data.user.email', 'test-acheteur@example.com')
        ->assertJsonPath('data.user.role', 'acheteur');

    // Verify user exists in DB
    $user = User::where('email', 'test-acheteur@example.com')->first();
    expect($user)->not->toBeNull();
    expect($user->role)->toBe('acheteur');

    // Password is hashed with bcrypt
    expect($user->password)->toMatch('/^\$2[aby]\$/');
    expect($user->password)->not->toBe('SecureP@ss123');

    // Token was returned
    expect($response->json('data.token'))->toBeString()->not->toBeEmpty();
});

test('register as vendeur creates user with vendeur role', function () {
    $response = $this->postJson('/api/register', [
        'email' => 'test-vendeur@example.com',
        'password' => 'SecureP@ss456',
        'password_confirmation' => 'SecureP@ss456',
        'role' => 'vendeur',
    ]);

    $response->assertStatus(201)
        ->assertJsonPath('data.user.email', 'test-vendeur@example.com')
        ->assertJsonPath('data.user.role', 'vendeur');

    $user = User::where('email', 'test-vendeur@example.com')->first();
    expect($user)->not->toBeNull();
    expect($user->role)->toBe('vendeur');
    expect($user->password)->toMatch('/^\$2[aby]\$/');
});

test('register creates a Passport access token in the database', function () {
    $response = $this->postJson('/api/register', [
        'email' => 'test-token@example.com',
        'password' => 'SecureP@ss789',
        'password_confirmation' => 'SecureP@ss789',
        'role' => 'acheteur',
    ]);

    $response->assertStatus(201);

    $user = User::where('email', 'test-token@example.com')->first();
    expect($user)->not->toBeNull();

    // Verify token exists in oauth_access_tokens table
    $this->assertDatabaseHas('oauth_access_tokens', [
        'user_id' => $user->id,
        'revoked' => false,
    ]);
});

test('register response does not expose password', function () {
    $response = $this->postJson('/api/register', [
        'email' => 'test-nopwd@example.com',
        'password' => 'SecureP@ss123',
        'password_confirmation' => 'SecureP@ss123',
        'role' => 'acheteur',
    ]);

    $response->assertStatus(201);

    // Ensure password is NOT in the response
    $userData = $response->json('data.user');
    expect($userData)->not->toHaveKey('password');
    expect($userData)->not->toHaveKey('remember_token');
});

// ===========================================================================
// AC2 — Duplicate email
// ===========================================================================

test('registration with duplicate email returns validation error', function () {
    // Create first user
    User::factory()->create([
        'email' => 'duplicate@example.com',
        'role' => 'acheteur',
    ]);

    $response = $this->postJson('/api/register', [
        'email' => 'duplicate@example.com',
        'password' => 'SecureP@ss123',
        'password_confirmation' => 'SecureP@ss123',
        'role' => 'vendeur',
    ]);

    $response->assertStatus(422)
        ->assertJsonValidationErrors(['email']);

    // Only one user with this email
    expect(User::where('email', 'duplicate@example.com')->count())->toBe(1);
});

test('duplicate email error message mentions email is already taken', function () {
    User::factory()->create([
        'email' => 'taken@example.com',
        'role' => 'acheteur',
    ]);

    $response = $this->postJson('/api/register', [
        'email' => 'taken@example.com',
        'password' => 'SecureP@ss123',
        'password_confirmation' => 'SecureP@ss123',
        'role' => 'acheteur',
    ]);

    $response->assertStatus(422);

    $emailErrors = $response->json('errors.email');
    expect($emailErrors)->toBeArray();
    expect(implode(' ', $emailErrors))->toContain('déjà utilisée');
});

// ===========================================================================
// AC3 — Invalid password (< 8 characters)
// ===========================================================================

test('registration with password shorter than 8 characters returns validation error', function () {
    $response = $this->postJson('/api/register', [
        'email' => 'test-short@example.com',
        'password' => 'Short1',
        'password_confirmation' => 'Short1',
        'role' => 'acheteur',
    ]);

    $response->assertStatus(422)
        ->assertJsonValidationErrors(['password']);

    // No user should be created
    $this->assertDatabaseMissing('users', ['email' => 'test-short@example.com']);
});

test('registration with exactly 7 character password is rejected', function () {
    $response = $this->postJson('/api/register', [
        'email' => 'test-7chars@example.com',
        'password' => 'Abcdef7',
        'password_confirmation' => 'Abcdef7',
        'role' => 'vendeur',
    ]);

    $response->assertStatus(422)
        ->assertJsonValidationErrors(['password']);

    $this->assertDatabaseMissing('users', ['email' => 'test-7chars@example.com']);
});

test('registration with exactly 8 character password is accepted', function () {
    $response = $this->postJson('/api/register', [
        'email' => 'test-8chars@example.com',
        'password' => 'Abcdefg8',
        'password_confirmation' => 'Abcdefg8',
        'role' => 'vendeur',
    ]);

    $response->assertStatus(201);

    $user = User::where('email', 'test-8chars@example.com')->first();
    expect($user)->not->toBeNull();
    expect($user->password)->toMatch('/^\$2[aby]\$/');
});

test('password error message mentions minimum 8 characters', function () {
    $response = $this->postJson('/api/register', [
        'email' => 'test-pwderror@example.com',
        'password' => 'short',
        'password_confirmation' => 'short',
        'role' => 'acheteur',
    ]);

    $response->assertStatus(422);

    $pwdErrors = $response->json('errors.password');
    expect($pwdErrors)->toBeArray();
    expect(implode(' ', $pwdErrors))->toContain('8 caractères');
});

// ===========================================================================
// Validation — Password confirmation mismatch
// ===========================================================================

test('registration with mismatched password confirmation returns error', function () {
    $response = $this->postJson('/api/register', [
        'email' => 'test-mismatch@example.com',
        'password' => 'SecureP@ss123',
        'password_confirmation' => 'DifferentPass',
        'role' => 'acheteur',
    ]);

    $response->assertStatus(422)
        ->assertJsonValidationErrors(['password']);

    $this->assertDatabaseMissing('users', ['email' => 'test-mismatch@example.com']);
});

// ===========================================================================
// Validation — Missing fields
// ===========================================================================

test('registration with missing email returns validation error', function () {
    $response = $this->postJson('/api/register', [
        'password' => 'SecureP@ss123',
        'password_confirmation' => 'SecureP@ss123',
        'role' => 'acheteur',
    ]);

    $response->assertStatus(422)
        ->assertJsonValidationErrors(['email']);
});

test('registration with missing password returns validation error', function () {
    $response = $this->postJson('/api/register', [
        'email' => 'test-nopwd@example.com',
        'role' => 'acheteur',
    ]);

    $response->assertStatus(422)
        ->assertJsonValidationErrors(['password']);
});

test('registration with missing role returns validation error', function () {
    $response = $this->postJson('/api/register', [
        'email' => 'test-norole@example.com',
        'password' => 'SecureP@ss123',
        'password_confirmation' => 'SecureP@ss123',
    ]);

    $response->assertStatus(422)
        ->assertJsonValidationErrors(['role']);

    $this->assertDatabaseMissing('users', ['email' => 'test-norole@example.com']);
});

test('registration with invalid role returns validation error', function () {
    $response = $this->postJson('/api/register', [
        'email' => 'test-badrole@example.com',
        'password' => 'SecureP@ss123',
        'password_confirmation' => 'SecureP@ss123',
        'role' => 'admin',
    ]);

    $response->assertStatus(422)
        ->assertJsonValidationErrors(['role']);

    $this->assertDatabaseMissing('users', ['email' => 'test-badrole@example.com']);
});

test('registration with invalid email format returns validation error', function () {
    $response = $this->postJson('/api/register', [
        'email' => 'not-an-email',
        'password' => 'SecureP@ss123',
        'password_confirmation' => 'SecureP@ss123',
        'role' => 'acheteur',
    ]);

    $response->assertStatus(422)
        ->assertJsonValidationErrors(['email']);
});

test('registration with empty body returns validation errors', function () {
    $response = $this->postJson('/api/register', []);

    $response->assertStatus(422)
        ->assertJsonValidationErrors(['email', 'password', 'role']);
});
