<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    /**
     * GET /api/dashboard
     *
     * Returns general dashboard data for the authenticated user.
     * Available to all authenticated users regardless of role.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json([
            'data' => [
                'user' => new UserResource($user),
            ],
        ], 200);
    }
}
