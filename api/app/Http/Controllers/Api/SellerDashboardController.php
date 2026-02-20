<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\DashboardService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SellerDashboardController extends Controller
{
    public function __construct(
        private readonly DashboardService $dashboardService
    ) {}

    /**
     * GET /api/seller/dashboard
     *
     * Returns seller dashboard data (stats, products).
     * Protected by auth:api + role:vendeur middleware.
     */
    public function index(Request $request): JsonResponse
    {
        $data = $this->dashboardService->getSellerDashboard($request->user());

        return response()->json([
            'data' => $data,
        ], 200);
    }
}
