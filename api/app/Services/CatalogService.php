<?php

namespace App\Services;

use App\Enums\ProductCategory;
use App\Models\Product;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class CatalogService
{
    /**
     * Get all 8 fixed categories with slug, label, and icon.
     *
     * Story 3.1 AC1: Returns the 8 fixed categories for the homepage.
     *
     * @return array<int, array{slug: string, label: string, icon: string, description: string}>
     */
    public function getCategories(): array
    {
        $descriptions = [
            'cpu' => 'Processeurs pour tous les usages',
            'gpu' => 'Cartes graphiques pour le gaming et le calcul',
            'ram' => 'Mémoire vive pour vos configurations',
            'stockage' => 'SSD, HDD et solutions de stockage',
            'cm' => 'Cartes mères compatibles',
            'alimentation' => 'Blocs d\'alimentation fiables',
            'boitier' => 'Boîtiers PC de toutes tailles',
            'peripheriques' => 'Claviers, souris et accessoires',
        ];

        $icons = [
            'cpu' => "\u{1F532}",          // 🔲
            'gpu' => "\u{1F3AE}",          // 🎮
            'ram' => "\u{1F4BE}",          // 💾
            'stockage' => "\u{1F4BF}",     // 💿
            'cm' => "\u{1F5A5}\u{FE0F}",  // 🖥️
            'alimentation' => "\u{26A1}",  // ⚡
            'boitier' => "\u{1F4E6}",      // 📦
            'peripheriques' => "\u{1F5B1}\u{FE0F}", // 🖱️
        ];

        return array_map(function (ProductCategory $category) use ($descriptions, $icons) {
            return [
                'slug' => $category->value,
                'label' => $category->label(),
                'icon' => $icons[$category->value] ?? '',
                'description' => $descriptions[$category->value] ?? '',
            ];
        }, ProductCategory::cases());
    }

    /**
     * Get paginated active products for a given category slug.
     *
     * Story 3.1 AC2 + Story 3.2 AC2: Returns only active products from the specified category.
     * Default perPage = 12 for Story 3.2 frontend grid pagination.
     *
     * @throws \InvalidArgumentException if slug is not a valid category
     */
    public function getProductsByCategory(string $slug, int $perPage = 12): ?LengthAwarePaginator
    {
        // Validate the slug against the enum
        $category = ProductCategory::tryFrom($slug);

        if ($category === null) {
            return null;
        }

        return Product::where('category', $category->value)
            ->where('is_active', true)
            ->with('seller')
            ->orderBy('created_at', 'desc')
            ->paginate($perPage);
    }

    /**
     * Get a single active product by ID with seller info.
     *
     * Story 3.2 AC3: Returns product detail for the detail page.
     * Public route — no auth required.
     */
    public function getProductById(int $id): ?Product
    {
        return Product::where('id', $id)
            ->where('is_active', true)
            ->with('seller')
            ->first();
    }

    /**
     * Check if a given slug is a valid category.
     */
    public function isValidCategory(string $slug): bool
    {
        return ProductCategory::tryFrom($slug) !== null;
    }
}
