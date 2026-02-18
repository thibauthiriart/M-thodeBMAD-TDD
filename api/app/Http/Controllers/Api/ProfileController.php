<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\UpdateProfileRequest;
use App\Http\Resources\UserResource;
use App\Services\ProfileService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProfileController extends Controller
{
    public function __construct(
        private readonly ProfileService $profileService
    ) {}

    /**
     * Display the authenticated user's profile.
     *
     * GET /api/profile
     */
    public function show(Request $request): JsonResponse
    {
        $user = $this->profileService->getProfile($request->user());

        return (new UserResource($user))
            ->response()
            ->setStatusCode(200);
    }

    /**
     * Update the authenticated user's profile.
     *
     * PUT /api/profile
     */
    public function update(UpdateProfileRequest $request): JsonResponse
    {
        $user = $this->profileService->updateProfile(
            $request->user(),
            $request->validated()
        );

        return (new UserResource($user))
            ->response()
            ->setStatusCode(200);
    }
}
