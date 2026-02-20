<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\DashboardService;
use Illuminate\Http\JsonResponse;

class AdminDashboardController extends Controller
{
    public function __construct(
        private readonly DashboardService $dashboardService
    ) {}

    /**
     * GET /api/admin/dashboard
     *
     * Returns admin dashboard data (stats, users).
     * Protected by auth:api + role:admin middleware.
     */
    public function index(): JsonResponse
    {
        $data = $this->dashboardService->getAdminDashboard();

        return response()->json([
            'data' => $data,
        ], 200);
    }
}
