<?php

namespace App\Services;

use App\Enums\ProductCategory;
use App\Models\Product;
use Illuminate\Database\Eloquent\Collection;

class ProductService
{
    /**
     * Get all active products for the public catalogue (no filters).
     *
     * Story 2.4: Only products with is_active = true are visible in the public catalogue.
     */
    public function getActiveProducts(): Collection
    {
        return $this->getFilteredProducts();
    }

    /**
     * Get filtered active products for the public catalogue.
     *
     * Story 3.3: Supports category, price_min, price_max, search filters.
     * All filters use AND logic. Search uses LIKE %term% on product name.
     * When no filters are provided, returns all active products.
     *
     * @param array{category?: string|null, price_min?: float|null, price_max?: float|null, search?: string|null} $filters
     */
    public function getFilteredProducts(array $filters = []): Collection
    {
        $query = Product::with('seller')->where('is_active', true);

        // Story 3.3 AC1: Filter by category slug
        if (!empty($filters['category'])) {
            $category = ProductCategory::tryFrom($filters['category']);
            if ($category !== null) {
                $query->where('category', $category->value);
            }
        }

        // Story 3.3 AC2: Filter by minimum price
        if (isset($filters['price_min']) && $filters['price_min'] !== null && $filters['price_min'] !== '') {
            $query->where('price', '>=', (float) $filters['price_min']);
        }

        // Story 3.3 AC2: Filter by maximum price
        if (isset($filters['price_max']) && $filters['price_max'] !== null && $filters['price_max'] !== '') {
            $query->where('price', '<=', (float) $filters['price_max']);
        }

        // Story 3.3 AC3: Search by name (LIKE %term%)
        if (!empty($filters['search'])) {
            $term = trim($filters['search']);
            if ($term !== '') {
                $query->where('name', 'LIKE', '%' . $term . '%');
            }
        }

        return $query->orderBy('created_at', 'desc')->get();
    }
}
