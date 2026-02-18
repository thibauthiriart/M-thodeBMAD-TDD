<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthService
{
    /**
     * Register a new user and create a Passport access token.
     *
     * @param array{email: string, password: string, role: string} $data
     * @return array{user: User, token: string}
     */
    public function register(array $data): array
    {
        $user = User::create([
            'name' => $data['name'] ?? '',
            'email' => $data['email'],
            'password' => $data['password'], // hashed by User model cast
            'role' => $data['role'],
        ]);

        $token = $user->createToken('auth-token')->accessToken;

        return [
            'user' => $user,
            'token' => $token,
        ];
    }

    /**
     * Authenticate a user and create a Passport access token.
     *
     * @param array{email: string, password: string} $data
     * @return array{user: User, token: string}
     *
     * @throws ValidationException
     */
    public function login(array $data): array
    {
        $user = User::where('email', $data['email'])->first();

        // Generic error — same message whether email doesn't exist or password is wrong
        // This prevents email enumeration attacks
        if (! $user || ! Hash::check($data['password'], $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['Les identifiants fournis sont incorrects.'],
            ]);
        }

        $token = $user->createToken('auth-token')->accessToken;

        return [
            'user' => $user,
            'token' => $token,
        ];
    }

    /**
     * Revoke the current user's access token (logout).
     */
    public function logout(User $user): void
    {
        $user->token()->revoke();
    }
}
