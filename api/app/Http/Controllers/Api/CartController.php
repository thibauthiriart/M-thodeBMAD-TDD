<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\AddToCartRequest;
use App\Http\Resources\CartResource;
use App\Services\CartService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CartController extends Controller
{
    public function __construct(
        private readonly CartService $cartService
    ) {}

    /**
     * GET /api/cart
     *
     * Get the authenticated buyer's cart.
     * Returns the full cart with items, or 404 if no cart exists.
     */
    public function show(Request $request): JsonResponse
    {
        $cart = $this->cartService->getCart($request->user());

        if (!$cart) {
            return response()->json(['data' => null], 404);
        }

        return (new CartResource($cart))
            ->response()
            ->setStatusCode(200);
    }

    /**
     * POST /api/cart/items
     *
     * Add a product to the authenticated buyer's cart.
     *
     * Story 4.1:
     * - AC1: Adds product with quantity 1 (or specified quantity)
     * - AC2: Increments quantity if product already in cart
     * - Product must be active and in stock
     * - Returns the full cart with items (CartResource)
     */
    public function addItem(AddToCartRequest $request): JsonResponse
    {
        $data = $request->validated();

        $cart = $this->cartService->addItem(
            $request->user(),
            $data['product_id'],
            $data['quantity'] ?? 1
        );

        return (new CartResource($cart))
            ->response()
            ->setStatusCode(200);
    }
}
