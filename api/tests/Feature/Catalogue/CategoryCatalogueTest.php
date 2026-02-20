<?php

use App\Enums\ProductCategory;
use App\Models\Product;
use App\Models\User;

// ===========================================================================
// GET /api/categories — Public categories list
// Story 3.1 AC1: Returns the 8 fixed categories
// ===========================================================================

// ---------------------------------------------------------------------------
// Happy path — Returns all 8 categories
// ---------------------------------------------------------------------------

test('GET /api/categories returns 200 with all 8 categories', function () {
    $response = $this->getJson('/api/categories');

    $response->assertStatus(200)
        ->assertJsonStructure([
            'data' => [
                '*' => ['slug', 'label', 'icon', 'description'],
            ],
        ])
        ->assertJsonCount(8, 'data');

    $slugs = collect($response->json('data'))->pluck('slug')->toArray();

    foreach (ProductCategory::values() as $expectedSlug) {
        expect($slugs)->toContain($expectedSlug);
    }
});

test('GET /api/categories returns correct labels for all categories', function () {
    $response = $this->getJson('/api/categories');

    $response->assertStatus(200);

    $categories = collect($response->json('data'));

    $expectedLabels = [
        'cpu' => 'CPU',
        'gpu' => 'GPU',
        'ram' => 'RAM',
        'stockage' => 'Stockage',
        'cm' => 'Carte Mère',
        'alimentation' => 'Alimentation',
        'boitier' => 'Boîtier',
        'peripheriques' => 'Périphériques',
    ];

    foreach ($expectedLabels as $slug => $label) {
        $cat = $categories->firstWhere('slug', $slug);
        expect($cat)->not->toBeNull();
        expect($cat['label'])->toBe($label);
    }
});

test('GET /api/categories does not require authentication', function () {
    $response = $this->getJson('/api/categories');

    $response->assertStatus(200);
    // Should NOT return 401 or 403
    expect($response->status())->not->toBe(401);
    expect($response->status())->not->toBe(403);
});

test('GET /api/categories each category has non-empty icon and description', function () {
    $response = $this->getJson('/api/categories');

    $response->assertStatus(200);

    foreach ($response->json('data') as $category) {
        expect($category['icon'])->not->toBeEmpty();
        expect($category['description'])->not->toBeEmpty();
    }
});

// ===========================================================================
// GET /api/categories/{slug}/products — Products by category
// Story 3.1 AC2: Returns paginated active products for a category
// ===========================================================================

// ---------------------------------------------------------------------------
// Happy path — Returns products for a valid category
// ---------------------------------------------------------------------------

test('GET /api/categories/cpu/products returns 200 with products array', function () {
    $vendeur = User::factory()->vendeur()->create();
    Product::factory()->for($vendeur, 'seller')->create([
        'category' => ProductCategory::CPU->value,
        'is_active' => true,
    ]);

    $response = $this->getJson('/api/categories/cpu/products');

    $response->assertStatus(200)
        ->assertJsonStructure([
            'data' => [
                '*' => ['id', 'name', 'description', 'category', 'price', 'stock_quantity', 'seller_name'],
            ],
        ]);
});

test('products returned by category endpoint only contain products from that category', function () {
    $vendeur = User::factory()->vendeur()->create();

    Product::factory()->for($vendeur, 'seller')->create([
        'category' => ProductCategory::CPU->value,
        'is_active' => true,
        'name' => 'CPU Product',
    ]);

    Product::factory()->for($vendeur, 'seller')->create([
        'category' => ProductCategory::GPU->value,
        'is_active' => true,
        'name' => 'GPU Product',
    ]);

    $response = $this->getJson('/api/categories/cpu/products');

    $response->assertStatus(200);

    foreach ($response->json('data') as $product) {
        expect($product['category'])->toBe('cpu');
    }
});

test('products endpoint returns expected fields for each product', function () {
    $vendeur = User::factory()->vendeur()->create(['name' => 'Test Seller']);
    Product::factory()->for($vendeur, 'seller')->create([
        'category' => ProductCategory::GPU->value,
        'is_active' => true,
    ]);

    $response = $this->getJson('/api/categories/gpu/products');

    $response->assertStatus(200);

    $products = $response->json('data');
    expect(count($products))->toBeGreaterThan(0);

    $product = $products[0];
    expect($product)->toHaveKeys(['id', 'name', 'description', 'category', 'price', 'stock_quantity', 'seller_name']);
    expect($product['seller_name'])->toBe('Test Seller');
});

test('GET /api/categories/{slug}/products does not require authentication', function () {
    $response = $this->getJson('/api/categories/ram/products');

    $response->assertStatus(200);
    expect($response->status())->not->toBe(401);
    expect($response->status())->not->toBe(403);
});

test('GET /api/categories/{slug}/products supports pagination', function () {
    $vendeur = User::factory()->vendeur()->create();

    // Create 20 products to exceed default page size
    Product::factory()
        ->count(20)
        ->for($vendeur, 'seller')
        ->create([
            'category' => ProductCategory::CPU->value,
            'is_active' => true,
        ]);

    $response = $this->getJson('/api/categories/cpu/products?page=1');

    $response->assertStatus(200);

    // Paginated response should have data + meta/links
    $json = $response->json();
    expect($json)->toHaveKey('data');
    expect($json)->toHaveKey('meta');
    expect($json)->toHaveKey('links');
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

test('GET /api/categories/invalid-slug/products returns 404', function () {
    $response = $this->getJson('/api/categories/nonexistent/products');

    $response->assertStatus(404);
});

test('all 8 category endpoints are accessible and return 200', function () {
    foreach (ProductCategory::values() as $slug) {
        $response = $this->getJson("/api/categories/{$slug}/products");
        $response->assertStatus(200);
    }
});

test('products endpoint only returns active products', function () {
    $vendeur = User::factory()->vendeur()->create();

    $activeProduct = Product::factory()->for($vendeur, 'seller')->create([
        'category' => ProductCategory::CPU->value,
        'is_active' => true,
        'name' => 'Active CPU',
    ]);

    $inactiveProduct = Product::factory()->for($vendeur, 'seller')->inactive()->create([
        'category' => ProductCategory::CPU->value,
        'name' => 'Inactive CPU',
    ]);

    $response = $this->getJson('/api/categories/cpu/products');

    $response->assertStatus(200);

    $productIds = collect($response->json('data'))->pluck('id')->toArray();

    expect($productIds)->toContain($activeProduct->id);
    expect($productIds)->not->toContain($inactiveProduct->id);
});

test('category endpoint returns empty data array when no products exist for category', function () {
    // No products created for this category
    $response = $this->getJson('/api/categories/peripheriques/products');

    $response->assertStatus(200)
        ->assertJsonStructure(['data'])
        ->assertJsonCount(0, 'data');
});

test('products include seller_name field from the related user', function () {
    $vendeur = User::factory()->vendeur()->create(['name' => 'Jean Vendeur']);
    Product::factory()->for($vendeur, 'seller')->create([
        'category' => ProductCategory::ALIMENTATION->value,
        'is_active' => true,
    ]);

    $response = $this->getJson('/api/categories/alimentation/products');

    $response->assertStatus(200);

    $product = $response->json('data.0');
    expect($product['seller_name'])->toBe('Jean Vendeur');
});

test('category products are ordered by created_at desc (newest first)', function () {
    $vendeur = User::factory()->vendeur()->create();

    $oldProduct = Product::factory()->for($vendeur, 'seller')->create([
        'category' => ProductCategory::RAM->value,
        'is_active' => true,
        'name' => 'Old RAM',
        'created_at' => now()->subDays(5),
    ]);

    $newProduct = Product::factory()->for($vendeur, 'seller')->create([
        'category' => ProductCategory::RAM->value,
        'is_active' => true,
        'name' => 'New RAM',
        'created_at' => now(),
    ]);

    $response = $this->getJson('/api/categories/ram/products');

    $response->assertStatus(200);

    $productIds = collect($response->json('data'))->pluck('id')->toArray();

    // Newest first
    $newIndex = array_search($newProduct->id, $productIds);
    $oldIndex = array_search($oldProduct->id, $productIds);

    expect($newIndex)->toBeLessThan($oldIndex);
});

// ---------------------------------------------------------------------------
// AC3 — Public access: authenticated users can also access
// ---------------------------------------------------------------------------

test('authenticated acheteur can access categories endpoint', function () {
    $acheteur = User::factory()->acheteur()->create();

    $response = $this->actingAs($acheteur, 'api')
        ->getJson('/api/categories');

    $response->assertStatus(200)
        ->assertJsonCount(8, 'data');
});

test('authenticated vendeur can access categories endpoint', function () {
    $vendeur = User::factory()->vendeur()->create();

    $response = $this->actingAs($vendeur, 'api')
        ->getJson('/api/categories');

    $response->assertStatus(200)
        ->assertJsonCount(8, 'data');
});

test('authenticated acheteur can access products by category endpoint', function () {
    $acheteur = User::factory()->acheteur()->create();

    $response = $this->actingAs($acheteur, 'api')
        ->getJson('/api/categories/cpu/products');

    $response->assertStatus(200);
});

test('authenticated vendeur can access products by category endpoint', function () {
    $vendeur = User::factory()->vendeur()->create();

    $response = $this->actingAs($vendeur, 'api')
        ->getJson('/api/categories/gpu/products');

    $response->assertStatus(200);
});
