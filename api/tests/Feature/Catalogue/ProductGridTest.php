<?php

use App\Enums\ProductCategory;
use App\Models\Product;
use App\Models\User;

// ===========================================================================
// Story 3.2 — Product Grid (Master View) — Backend Tests
// ===========================================================================

// ---------------------------------------------------------------------------
// GET /api/categories/{slug}/products — Pagination with per_page parameter
// ---------------------------------------------------------------------------

test('GET /api/categories/cpu/products defaults to 12 products per page', function () {
    $vendeur = User::factory()->vendeur()->create();

    Product::factory()
        ->count(15)
        ->for($vendeur, 'seller')
        ->create([
            'category' => ProductCategory::CPU->value,
            'is_active' => true,
        ]);

    $response = $this->getJson('/api/categories/cpu/products');

    $response->assertStatus(200);

    $data = $response->json('data');
    expect(count($data))->toBe(12);
});

test('GET /api/categories/{slug}/products supports per_page query parameter', function () {
    $vendeur = User::factory()->vendeur()->create();

    Product::factory()
        ->count(10)
        ->for($vendeur, 'seller')
        ->create([
            'category' => ProductCategory::CPU->value,
            'is_active' => true,
        ]);

    $response = $this->getJson('/api/categories/cpu/products?per_page=5');

    $response->assertStatus(200);

    $data = $response->json('data');
    expect(count($data))->toBe(5);
});

test('GET /api/categories/{slug}/products pagination returns correct total in meta', function () {
    $vendeur = User::factory()->vendeur()->create();

    Product::factory()
        ->count(15)
        ->for($vendeur, 'seller')
        ->create([
            'category' => ProductCategory::GPU->value,
            'is_active' => true,
        ]);

    $response = $this->getJson('/api/categories/gpu/products');

    $response->assertStatus(200);

    $meta = $response->json('meta');
    expect($meta['total'])->toBe(15);
    expect($meta['per_page'])->toBe(12);
    expect($meta['last_page'])->toBe(2);
});

test('GET /api/categories/{slug}/products page 2 returns remaining products', function () {
    $vendeur = User::factory()->vendeur()->create();

    Product::factory()
        ->count(15)
        ->for($vendeur, 'seller')
        ->create([
            'category' => ProductCategory::CPU->value,
            'is_active' => true,
        ]);

    $response = $this->getJson('/api/categories/cpu/products?page=2');

    $response->assertStatus(200);

    $data = $response->json('data');
    // 15 total, 12 per page, page 2 should have 3
    expect(count($data))->toBe(3);
});

// ---------------------------------------------------------------------------
// GET /api/categories/{slug}/products — Multi-seller (FR30)
// ---------------------------------------------------------------------------

test('products from multiple sellers appear in the same category (FR30)', function () {
    $seller1 = User::factory()->vendeur()->create(['name' => 'Seller A']);
    $seller2 = User::factory()->vendeur()->create(['name' => 'Seller B']);

    Product::factory()->for($seller1, 'seller')->create([
        'category' => ProductCategory::CPU->value,
        'is_active' => true,
    ]);

    Product::factory()->for($seller2, 'seller')->create([
        'category' => ProductCategory::CPU->value,
        'is_active' => true,
    ]);

    $response = $this->getJson('/api/categories/cpu/products');

    $response->assertStatus(200);

    $products = $response->json('data');
    $sellerNames = array_unique(array_column($products, 'seller_name'));

    expect(count($sellerNames))->toBeGreaterThanOrEqual(2);
});

test('each product in category response includes seller_name', function () {
    $vendeur = User::factory()->vendeur()->create(['name' => 'Mon Vendeur']);

    Product::factory()->for($vendeur, 'seller')->create([
        'category' => ProductCategory::GPU->value,
        'is_active' => true,
    ]);

    $response = $this->getJson('/api/categories/gpu/products');

    $response->assertStatus(200);

    $product = $response->json('data.0');
    expect($product)->toHaveKey('seller_name');
    expect($product['seller_name'])->toBe('Mon Vendeur');
});

// ---------------------------------------------------------------------------
// GET /api/categories/{slug}/products — Only active products
// ---------------------------------------------------------------------------

test('only active products are returned in category listing', function () {
    $vendeur = User::factory()->vendeur()->create();

    $active = Product::factory()->for($vendeur, 'seller')->create([
        'category' => ProductCategory::RAM->value,
        'is_active' => true,
        'name' => 'Active RAM',
    ]);

    $inactive = Product::factory()->for($vendeur, 'seller')->inactive()->create([
        'category' => ProductCategory::RAM->value,
        'name' => 'Inactive RAM',
    ]);

    $response = $this->getJson('/api/categories/ram/products');

    $response->assertStatus(200);

    $productIds = collect($response->json('data'))->pluck('id')->toArray();

    expect($productIds)->toContain($active->id);
    expect($productIds)->not->toContain($inactive->id);
});

// ---------------------------------------------------------------------------
// GET /api/categories/{slug}/products — Response structure
// ---------------------------------------------------------------------------

test('category products response includes all required fields for Story 3.2', function () {
    $vendeur = User::factory()->vendeur()->create(['name' => 'TestSeller']);

    Product::factory()->for($vendeur, 'seller')->create([
        'category' => ProductCategory::CPU->value,
        'is_active' => true,
        'photo_url' => 'https://example.com/photo.jpg',
    ]);

    $response = $this->getJson('/api/categories/cpu/products');

    $response->assertStatus(200)
        ->assertJsonStructure([
            'data' => [
                '*' => ['id', 'name', 'price', 'photo_url', 'seller_name', 'stock_quantity', 'is_active'],
            ],
            'meta' => ['current_page', 'last_page', 'per_page', 'total'],
        ]);
});

// ---------------------------------------------------------------------------
// GET /api/products/{id} — Product detail endpoint
// ---------------------------------------------------------------------------

test('GET /api/products/{id} returns 200 with product detail for active product', function () {
    $vendeur = User::factory()->vendeur()->create(['name' => 'Detail Seller']);

    $product = Product::factory()->for($vendeur, 'seller')->create([
        'category' => ProductCategory::GPU->value,
        'is_active' => true,
        'name' => 'RTX 4090 Test',
        'description' => 'A powerful GPU',
        'price' => 1599.99,
        'stock_quantity' => 5,
        'photo_url' => 'https://example.com/rtx4090.jpg',
    ]);

    $response = $this->getJson("/api/products/{$product->id}");

    $response->assertStatus(200)
        ->assertJsonStructure([
            'data' => ['id', 'name', 'description', 'category', 'price', 'stock_quantity', 'seller_name', 'photo_url', 'is_active', 'specs'],
        ])
        ->assertJsonPath('data.id', $product->id)
        ->assertJsonPath('data.name', 'RTX 4090 Test')
        ->assertJsonPath('data.seller_name', 'Detail Seller')
        ->assertJsonPath('data.price', 1599.99);
});

test('GET /api/products/{id} returns 404 for inactive product', function () {
    $vendeur = User::factory()->vendeur()->create();

    $product = Product::factory()->for($vendeur, 'seller')->inactive()->create([
        'category' => ProductCategory::CPU->value,
    ]);

    $response = $this->getJson("/api/products/{$product->id}");

    $response->assertStatus(404);
});

test('GET /api/products/{id} returns 404 for non-existent product', function () {
    $response = $this->getJson('/api/products/999999');

    $response->assertStatus(404);
});

test('GET /api/products/{id} does not require authentication', function () {
    $vendeur = User::factory()->vendeur()->create();

    $product = Product::factory()->for($vendeur, 'seller')->create([
        'category' => ProductCategory::GPU->value,
        'is_active' => true,
    ]);

    $response = $this->getJson("/api/products/{$product->id}");

    $response->assertStatus(200);
    expect($response->status())->not->toBe(401);
    expect($response->status())->not->toBe(403);
});

test('GET /api/products/{id} includes seller_name in response', function () {
    $vendeur = User::factory()->vendeur()->create(['name' => 'Super Seller']);

    $product = Product::factory()->for($vendeur, 'seller')->create([
        'category' => ProductCategory::CPU->value,
        'is_active' => true,
    ]);

    $response = $this->getJson("/api/products/{$product->id}");

    $response->assertStatus(200);
    expect($response->json('data.seller_name'))->toBe('Super Seller');
});

test('authenticated acheteur can access product detail', function () {
    $acheteur = User::factory()->acheteur()->create();
    $vendeur = User::factory()->vendeur()->create();

    $product = Product::factory()->for($vendeur, 'seller')->create([
        'category' => ProductCategory::GPU->value,
        'is_active' => true,
    ]);

    $response = $this->actingAs($acheteur, 'api')
        ->getJson("/api/products/{$product->id}");

    $response->assertStatus(200);
});

test('authenticated vendeur can access product detail', function () {
    $vendeur = User::factory()->vendeur()->create();

    $product = Product::factory()->for($vendeur, 'seller')->create([
        'category' => ProductCategory::RAM->value,
        'is_active' => true,
    ]);

    $response = $this->actingAs($vendeur, 'api')
        ->getJson("/api/products/{$product->id}");

    $response->assertStatus(200);
});

// ---------------------------------------------------------------------------
// per_page edge cases
// ---------------------------------------------------------------------------

test('per_page parameter is clamped to maximum 100', function () {
    $vendeur = User::factory()->vendeur()->create();

    Product::factory()
        ->count(5)
        ->for($vendeur, 'seller')
        ->create([
            'category' => ProductCategory::CPU->value,
            'is_active' => true,
        ]);

    $response = $this->getJson('/api/categories/cpu/products?per_page=200');

    $response->assertStatus(200);

    $meta = $response->json('meta');
    expect($meta['per_page'])->toBe(100);
});

test('per_page parameter minimum is 1', function () {
    $vendeur = User::factory()->vendeur()->create();

    Product::factory()->for($vendeur, 'seller')->create([
        'category' => ProductCategory::CPU->value,
        'is_active' => true,
    ]);

    $response = $this->getJson('/api/categories/cpu/products?per_page=0');

    $response->assertStatus(200);

    $meta = $response->json('meta');
    expect($meta['per_page'])->toBe(1);
});
