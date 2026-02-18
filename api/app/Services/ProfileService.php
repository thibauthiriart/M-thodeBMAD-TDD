<?php

namespace App\Services;

use App\Models\User;

class ProfileService
{
    /**
     * Get the user's profile data.
     */
    public function getProfile(User $user): User
    {
        return $user;
    }

    /**
     * Update the user's profile (only editable fields: name).
     *
     * @param array{name: string} $data
     */
    public function updateProfile(User $user, array $data): User
    {
        $user->update([
            'name' => $data['name'],
        ]);

        return $user->fresh();
    }
}
