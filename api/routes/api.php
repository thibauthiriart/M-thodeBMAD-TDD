<?php

use App\Http\Controllers\Api\AdminDashboardController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CartController;
use App\Http\Controllers\Api\CatalogController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\ProfileController;
use App\Http\Controllers\Api\SellerDashboardController;
use App\Http\Controllers\Api\SellerProductController;
use Illuminate\Support\Facades\Route;

// ===========================================================================
// Public routes (no auth required)
// ===========================================================================
Route::post('/register', [AuthController::class, 'register']);
Route::post('/auth/register', [AuthController::class, 'register']);
Route::post('/auth/login', [AuthController::class, 'login']);

// Public catalogue — only active products (Story 2.4)
Route::get('/products', [ProductController::class, 'index']);

// Public catalogue — categories & products by category (Story 3.1 + 3.2)
Route::get('/categories', [CatalogController::class, 'categories']);
Route::get('/categories/{slug}/products', [CatalogController::class, 'productsByCategory']);

// Public product detail (Story 3.2 AC3)
Route::get('/products/{id}', [CatalogController::class, 'show'])->where('id', '[0-9]+');

// ===========================================================================
// Protected routes (require valid Passport token)
// ===========================================================================
Route::middleware('auth:api')->group(function () {
    // Auth management
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::get('/auth/me', [AuthController::class, 'me']);

    // Profile management (all authenticated users)
    Route::get('/profile', [ProfileController::class, 'show']);
    Route::put('/profile', [ProfileController::class, 'update']);

    // General dashboard (all authenticated users)
    Route::get('/dashboard', [DashboardController::class, 'index']);

    // Cart routes — Story 4.1: Add to Cart (all authenticated buyers)
    Route::get('/cart', [CartController::class, 'show']);
    Route::post('/cart/items', [CartController::class, 'addItem']);

    // Seller routes (vendeur + admin can access)
    Route::middleware('role:vendeur,admin')->group(function () {
        Route::get('/seller/dashboard', [SellerDashboardController::class, 'index']);
        Route::get('/seller/products', [SellerProductController::class, 'index']);
        Route::post('/seller/products', [SellerProductController::class, 'store']);
        Route::get('/seller/products/{id}', [SellerProductController::class, 'show']);
        Route::put('/seller/products/{id}', [SellerProductController::class, 'update']);
    });

    // Seller-only routes (vendeur only — admin cannot toggle/delete products)
    Route::middleware('role:vendeur')->group(function () {
        Route::patch('/seller/products/{id}/toggle-status', [SellerProductController::class, 'toggleStatus']);
        Route::delete('/seller/products/{id}', [SellerProductController::class, 'destroy']);
    });

    // Admin routes (admin only)
    Route::middleware('role:admin')->group(function () {
        Route::get('/admin/dashboard', [AdminDashboardController::class, 'index']);
    });
});
