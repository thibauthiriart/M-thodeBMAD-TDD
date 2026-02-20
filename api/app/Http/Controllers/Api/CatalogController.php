<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\CatalogProductResource;
use App\Http\Resources\CategoryResource;
use App\Http\Resources\ProductDetailResource;
use App\Services\CatalogService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class CatalogController extends Controller
{
    public function __construct(
        private readonly CatalogService $catalogService
    ) {}

    /**
     * GET /api/categories
     *
     * Story 3.1 AC1: Returns the 8 fixed categories.
     * Public route — no auth required (AC3).
     */
    public function categories(): AnonymousResourceCollection
    {
        $categories = $this->catalogService->getCategories();

        return CategoryResource::collection($categories);
    }

    /**
     * GET /api/categories/{slug}/products
     *
     * Story 3.1 AC2 + Story 3.2: Returns paginated active products for a category.
     * Supports per_page query parameter (default 12).
     * Public route — no auth required (AC3).
     */
    public function productsByCategory(Request $request, string $slug): AnonymousResourceCollection|JsonResponse
    {
        $perPage = (int) $request->query('per_page', 12);

        // Clamp per_page to a reasonable range
        $perPage = max(1, min($perPage, 100));

        $products = $this->catalogService->getProductsByCategory($slug, $perPage);

        if ($products === null) {
            return response()->json([
                'message' => 'Categorie introuvable.',
            ], 404);
        }

        return CatalogProductResource::collection($products);
    }

    /**
     * GET /api/products/{id}
     *
     * Story 3.2 AC3: Returns a single active product detail.
     * Public route — no auth required.
     */
    public function show(int $id): ProductDetailResource|JsonResponse
    {
        $product = $this->catalogService->getProductById($id);

        if ($product === null) {
            return response()->json([
                'message' => 'Produit introuvable.',
            ], 404);
        }

        return new ProductDetailResource($product);
    }
}
