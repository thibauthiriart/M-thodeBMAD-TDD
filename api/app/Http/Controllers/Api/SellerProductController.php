<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreSellerProductRequest;
use App\Http\Requests\UpdateProductRequest;
use App\Http\Resources\ProductResource;
use App\Services\SellerProductService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class SellerProductController extends Controller
{
    public function __construct(
        private readonly SellerProductService $sellerProductService
    ) {}

    /**
     * GET /api/seller/products
     *
     * List all products belonging to the authenticated seller.
     * NFR11: Only returns the seller's own products (scoped by user_id).
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $products = $this->sellerProductService->getSellerProducts($request->user());

        return ProductResource::collection($products);
    }

    /**
     * GET /api/seller/products/{id}
     *
     * Show a single product belonging to the authenticated seller.
     * NFR11: Returns 403 if the product doesn't belong to the seller.
     */
    public function show(Request $request, int $id): JsonResponse
    {
        $product = $this->sellerProductService->getSellerProduct($request->user(), $id);

        if (!$product) {
            return response()->json([
                'message' => 'Ce produit ne vous appartient pas ou n\'existe pas.',
            ], 403);
        }

        return (new ProductResource($product))
            ->response()
            ->setStatusCode(200);
    }

    /**
     * POST /api/seller/products
     *
     * Create a new product for the authenticated seller.
     */
    public function store(StoreSellerProductRequest $request): JsonResponse
    {
        $data = $request->validated();

        // Ensure the photo file is passed through to the service
        if ($request->hasFile('photo')) {
            $data['photo'] = $request->file('photo');
        }

        $product = $this->sellerProductService->createProduct(
            $request->user(),
            $data
        );

        return (new ProductResource($product))
            ->response()
            ->setStatusCode(201);
    }

    /**
     * PATCH /api/seller/products/{id}/toggle-status
     *
     * Toggle the is_active status of a product belonging to the authenticated seller.
     * Story 2.4: Activate/Deactivate Product
     * NFR11: Returns 403 if the product doesn't belong to the seller.
     */
    public function toggleStatus(Request $request, int $id): JsonResponse
    {
        $product = $this->sellerProductService->toggleProductStatus($request->user(), $id);

        if (!$product) {
            return response()->json([
                'message' => 'Ce produit ne vous appartient pas ou n\'existe pas.',
            ], 403);
        }

        return (new ProductResource($product))
            ->response()
            ->setStatusCode(200);
    }

    /**
     * DELETE /api/seller/products/{id}
     *
     * Permanently delete a product belonging to the authenticated seller.
     * Story 2.5: Delete Product
     * NFR11: Returns 403 if the product doesn't belong to the seller.
     * Deletes associated photo from storage.
     * Returns 204 No Content on success.
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        $deleted = $this->sellerProductService->deleteProduct($request->user(), $id);

        if (!$deleted) {
            return response()->json([
                'message' => 'Ce produit ne vous appartient pas ou n\'existe pas.',
            ], 403);
        }

        return response()->json(null, 204);
    }

    /**
     * PUT /api/seller/products/{id}
     *
     * Update an existing product belonging to the authenticated seller.
     * NFR11: Returns 403 if the product doesn't belong to the seller.
     * Photo is optional on update (existing photo is kept if no new one provided).
     */
    public function update(UpdateProductRequest $request, int $id): JsonResponse
    {
        $data = $request->validated();

        // Ensure the photo file is passed through to the service
        if ($request->hasFile('photo')) {
            $data['photo'] = $request->file('photo');
        }

        $product = $this->sellerProductService->updateProduct(
            $request->user(),
            $id,
            $data
        );

        if (!$product) {
            return response()->json([
                'message' => 'Ce produit ne vous appartient pas ou n\'existe pas.',
            ], 403);
        }

        return (new ProductResource($product))
            ->response()
            ->setStatusCode(200);
    }
}
