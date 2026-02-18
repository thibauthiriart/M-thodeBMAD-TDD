<?php

namespace App\Services;

use App\Models\User;

class DashboardService
{
    /**
     * Get seller dashboard data for the given user.
     *
     * @return array{stats: array, products: array}
     */
    public function getSellerDashboard(User $user): array
    {
        // For now, return mock/placeholder data
        // In the future, this will query real products/orders
        return [
            'stats' => [
                'total_products' => 0,
                'total_orders' => 0,
                'revenue' => 0,
            ],
            'products' => [],
        ];
    }

    /**
     * Get admin dashboard data.
     *
     * @return array{stats: array, users: array}
     */
    public function getAdminDashboard(): array
    {
        $totalUsers = User::count();
        $totalSellers = User::where('role', 'vendeur')->count();
        $totalBuyers = User::where('role', 'acheteur')->count();
        $totalAdmins = User::where('role', 'admin')->count();

        return [
            'stats' => [
                'total_users' => $totalUsers,
                'total_sellers' => $totalSellers,
                'total_buyers' => $totalBuyers,
                'total_admins' => $totalAdmins,
            ],
            'users' => User::select('id', 'name', 'email', 'role', 'created_at')
                ->orderBy('created_at', 'desc')
                ->limit(50)
                ->get()
                ->toArray(),
        ];
    }
}
