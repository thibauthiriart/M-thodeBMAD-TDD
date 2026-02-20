<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\ProductFilterRequest;
use App\Http\Resources\CatalogProductResource;
use App\Services\ProductService;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class ProductController extends Controller
{
    public function __construct(
        private readonly ProductService $productService
    ) {}

    /**
     * GET /api/products
     *
     * Public catalogue — returns only active products (is_active = true).
     * Story 2.4: Deactivated products should not appear in the public catalogue.
     * Story 3.3: Supports filter query params: category, price_min, price_max, search.
     *            All filters use AND logic. Search uses LIKE %term% on product name.
     */
    public function index(ProductFilterRequest $request): AnonymousResourceCollection
    {
        $filters = $request->filters();

        $products = $this->productService->getFilteredProducts($filters);

        return CatalogProductResource::collection($products);
    }
}
