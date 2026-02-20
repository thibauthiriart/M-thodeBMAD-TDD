<?php

use App\Enums\ProductCategory;
use App\Models\Product;
use App\Models\User;

// ===========================================================================
// Story 3.3 — Product Filters — Backend Tests
// ===========================================================================

// ---------------------------------------------------------------------------
// AC1: GET /api/products?category= — Filter by category
// ---------------------------------------------------------------------------

test('GET /api/products?category=cpu returns only CPU products', function () {
    $vendeur = User::factory()->vendeur()->create();

    Product::factory()->for($vendeur, 'seller')->create([
        'category' => ProductCategory::CPU->value,
        'is_active' => true,
        'name' => 'AMD Ryzen 9',
    ]);

    Product::factory()->for($vendeur, 'seller')->create([
        'category' => ProductCategory::GPU->value,
        'is_active' => true,
        'name' => 'RTX 4090',
    ]);

    $response = $this->getJson('/api/products?category=cpu');

    $response->assertStatus(200);

    $products = $response->json('data');
    expect(count($products))->toBe(1);
    expect($products[0]['category'])->toBe('cpu');
    expect($products[0]['name'])->toBe('AMD Ryzen 9');
});

test('category filter returns products from all sellers in that category', function () {
    $seller1 = User::factory()->vendeur()->create(['name' => 'Seller A']);
    $seller2 = User::factory()->vendeur()->create(['name' => 'Seller B']);

    Product::factory()->for($seller1, 'seller')->create([
        'category' => ProductCategory::GPU->value,
        'is_active' => true,
    ]);

    Product::factory()->for($seller2, 'seller')->create([
        'category' => ProductCategory::GPU->value,
        'is_active' => true,
    ]);

    $response = $this->getJson('/api/products?category=gpu');

    $response->assertStatus(200);

    $products = $response->json('data');
    expect(count($products))->toBe(2);

    foreach ($products as $product) {
        expect($product['category'])->toBe('gpu');
    }
});

test('invalid category filter returns empty results', function () {
    $vendeur = User::factory()->vendeur()->create();

    Product::factory()->for($vendeur, 'seller')->create([
        'category' => ProductCategory::CPU->value,
        'is_active' => true,
    ]);

    $response = $this->getJson('/api/products?category=invalid_category');

    // The Form Request validation will reject invalid category values
    // It should return 422 validation error
    $response->assertStatus(422);
});

test('each of the 8 categories can be filtered individually', function () {
    $vendeur = User::factory()->vendeur()->create();

    foreach (ProductCategory::cases() as $category) {
        Product::factory()->for($vendeur, 'seller')->create([
            'category' => $category->value,
            'is_active' => true,
        ]);
    }

    foreach (ProductCategory::cases() as $category) {
        $response = $this->getJson("/api/products?category={$category->value}");

        $response->assertStatus(200);

        $products = $response->json('data');
        expect(count($products))->toBeGreaterThanOrEqual(1);

        foreach ($products as $product) {
            expect($product['category'])->toBe($category->value);
        }
    }
});

test('category filter excludes inactive products', function () {
    $vendeur = User::factory()->vendeur()->create();

    Product::factory()->for($vendeur, 'seller')->create([
        'category' => ProductCategory::RAM->value,
        'is_active' => true,
        'name' => 'Active RAM',
    ]);

    Product::factory()->for($vendeur, 'seller')->inactive()->create([
        'category' => ProductCategory::RAM->value,
        'name' => 'Inactive RAM',
    ]);

    $response = $this->getJson('/api/products?category=ram');

    $response->assertStatus(200);

    $products = $response->json('data');
    expect(count($products))->toBe(1);
    expect($products[0]['name'])->toBe('Active RAM');
});

// ---------------------------------------------------------------------------
// AC2: GET /api/products?price_min=&price_max= — Filter by price range
// ---------------------------------------------------------------------------

test('GET /api/products?price_min=500 returns only products >= 500', function () {
    $vendeur = User::factory()->vendeur()->create();

    Product::factory()->for($vendeur, 'seller')->create([
        'is_active' => true,
        'price' => 300.00,
        'name' => 'Cheap Product',
    ]);

    Product::factory()->for($vendeur, 'seller')->create([
        'is_active' => true,
        'price' => 500.00,
        'name' => 'Exact Min Product',
    ]);

    Product::factory()->for($vendeur, 'seller')->create([
        'is_active' => true,
        'price' => 700.00,
        'name' => 'Expensive Product',
    ]);

    $response = $this->getJson('/api/products?price_min=500');

    $response->assertStatus(200);

    $products = $response->json('data');
    expect(count($products))->toBe(2);

    foreach ($products as $product) {
        expect($product['price'])->toBeGreaterThanOrEqual(500);
    }
});

test('GET /api/products?price_max=200 returns only products <= 200', function () {
    $vendeur = User::factory()->vendeur()->create();

    Product::factory()->for($vendeur, 'seller')->create([
        'is_active' => true,
        'price' => 100.00,
        'name' => 'Under Budget',
    ]);

    Product::factory()->for($vendeur, 'seller')->create([
        'is_active' => true,
        'price' => 200.00,
        'name' => 'At Budget',
    ]);

    Product::factory()->for($vendeur, 'seller')->create([
        'is_active' => true,
        'price' => 300.00,
        'name' => 'Over Budget',
    ]);

    $response = $this->getJson('/api/products?price_max=200');

    $response->assertStatus(200);

    $products = $response->json('data');
    expect(count($products))->toBe(2);

    foreach ($products as $product) {
        expect($product['price'])->toBeLessThanOrEqual(200);
    }
});

test('GET /api/products?price_min=100&price_max=200 returns products in range', function () {
    $vendeur = User::factory()->vendeur()->create();

    Product::factory()->for($vendeur, 'seller')->create([
        'is_active' => true,
        'price' => 50.00,
        'name' => 'Too Cheap',
    ]);

    Product::factory()->for($vendeur, 'seller')->create([
        'is_active' => true,
        'price' => 150.00,
        'name' => 'In Range',
    ]);

    Product::factory()->for($vendeur, 'seller')->create([
        'is_active' => true,
        'price' => 300.00,
        'name' => 'Too Expensive',
    ]);

    $response = $this->getJson('/api/products?price_min=100&price_max=200');

    $response->assertStatus(200);

    $products = $response->json('data');
    expect(count($products))->toBe(1);
    expect($products[0]['name'])->toBe('In Range');
    expect($products[0]['price'])->toBeGreaterThanOrEqual(100);
    expect($products[0]['price'])->toBeLessThanOrEqual(200);
});

test('price range with no matching products returns empty array', function () {
    $vendeur = User::factory()->vendeur()->create();

    Product::factory()->for($vendeur, 'seller')->create([
        'is_active' => true,
        'price' => 100.00,
    ]);

    $response = $this->getJson('/api/products?price_min=999999&price_max=999999');

    $response->assertStatus(200);

    $products = $response->json('data');
    expect(count($products))->toBe(0);
});

test('price_min=0 does not filter out any products', function () {
    $vendeur = User::factory()->vendeur()->create();

    Product::factory()->for($vendeur, 'seller')->count(3)->create([
        'is_active' => true,
    ]);

    $responseAll = $this->getJson('/api/products');
    $responseFiltered = $this->getJson('/api/products?price_min=0');

    expect(count($responseFiltered->json('data')))->toBe(count($responseAll->json('data')));
});

// ---------------------------------------------------------------------------
// AC3: GET /api/products?search= — Filter by name (LIKE %term%)
// ---------------------------------------------------------------------------

test('GET /api/products?search=RTX returns products with RTX in name', function () {
    $vendeur = User::factory()->vendeur()->create();

    Product::factory()->for($vendeur, 'seller')->create([
        'is_active' => true,
        'name' => 'NVIDIA GeForce RTX 4090',
    ]);

    Product::factory()->for($vendeur, 'seller')->create([
        'is_active' => true,
        'name' => 'AMD Radeon RX 7900',
    ]);

    $response = $this->getJson('/api/products?search=RTX');

    $response->assertStatus(200);

    $products = $response->json('data');
    expect(count($products))->toBe(1);
    expect(str_contains(strtolower($products[0]['name']), 'rtx'))->toBeTrue();
});

test('search is case-insensitive (LIKE %term% on MySQL is case-insensitive by default)', function () {
    $vendeur = User::factory()->vendeur()->create();

    Product::factory()->for($vendeur, 'seller')->create([
        'is_active' => true,
        'name' => 'AMD Ryzen 9 7950X',
    ]);

    // Search with lowercase
    $response = $this->getJson('/api/products?search=ryzen');

    $response->assertStatus(200);

    $products = $response->json('data');
    expect(count($products))->toBe(1);
    expect(str_contains(strtolower($products[0]['name']), 'ryzen'))->toBeTrue();
});

test('search with partial name matches multiple products (LIKE %term%)', function () {
    $vendeur = User::factory()->vendeur()->create();

    Product::factory()->for($vendeur, 'seller')->create([
        'is_active' => true,
        'name' => 'Corsair Vengeance DDR5 32Go',
    ]);

    Product::factory()->for($vendeur, 'seller')->create([
        'is_active' => true,
        'name' => 'Corsair RM850x',
    ]);

    Product::factory()->for($vendeur, 'seller')->create([
        'is_active' => true,
        'name' => 'Samsung 990 Pro',
    ]);

    $response = $this->getJson('/api/products?search=Corsair');

    $response->assertStatus(200);

    $products = $response->json('data');
    expect(count($products))->toBe(2);

    foreach ($products as $product) {
        expect(str_contains(strtolower($product['name']), 'corsair'))->toBeTrue();
    }
});

test('search that matches no products returns empty array', function () {
    $vendeur = User::factory()->vendeur()->create();

    Product::factory()->for($vendeur, 'seller')->create([
        'is_active' => true,
        'name' => 'Real Product',
    ]);

    $response = $this->getJson('/api/products?search=ZZZZNONEXISTENT9999');

    $response->assertStatus(200);

    $products = $response->json('data');
    expect(count($products))->toBe(0);
});

test('search excludes inactive products', function () {
    $vendeur = User::factory()->vendeur()->create();

    Product::factory()->for($vendeur, 'seller')->create([
        'is_active' => true,
        'name' => 'Active Corsair Product',
    ]);

    Product::factory()->for($vendeur, 'seller')->inactive()->create([
        'name' => 'Inactive Corsair Product',
    ]);

    $response = $this->getJson('/api/products?search=Corsair');

    $response->assertStatus(200);

    $products = $response->json('data');
    expect(count($products))->toBe(1);
    expect($products[0]['name'])->toBe('Active Corsair Product');
});

// ---------------------------------------------------------------------------
// AC4: Combined filters — AND logic
// ---------------------------------------------------------------------------

test('category + search combined: only products matching BOTH', function () {
    $vendeur = User::factory()->vendeur()->create();

    // CPU Ryzen product (should match)
    Product::factory()->for($vendeur, 'seller')->create([
        'category' => ProductCategory::CPU->value,
        'is_active' => true,
        'name' => 'AMD Ryzen 9 7950X',
    ]);

    // GPU Ryzen product (should NOT match — wrong category)
    Product::factory()->for($vendeur, 'seller')->create([
        'category' => ProductCategory::GPU->value,
        'is_active' => true,
        'name' => 'Ryzen GPU Hybrid',
    ]);

    // CPU Intel product (should NOT match — wrong name)
    Product::factory()->for($vendeur, 'seller')->create([
        'category' => ProductCategory::CPU->value,
        'is_active' => true,
        'name' => 'Intel Core i9',
    ]);

    $response = $this->getJson('/api/products?category=cpu&search=Ryzen');

    $response->assertStatus(200);

    $products = $response->json('data');
    expect(count($products))->toBe(1);
    expect($products[0]['category'])->toBe('cpu');
    expect(str_contains(strtolower($products[0]['name']), 'ryzen'))->toBeTrue();
});

test('category + price range combined: only products matching BOTH', function () {
    $vendeur = User::factory()->vendeur()->create();

    // GPU in price range (should match)
    Product::factory()->for($vendeur, 'seller')->create([
        'category' => ProductCategory::GPU->value,
        'is_active' => true,
        'price' => 800.00,
        'name' => 'RTX 4070 Ti',
    ]);

    // GPU too expensive (should NOT match)
    Product::factory()->for($vendeur, 'seller')->create([
        'category' => ProductCategory::GPU->value,
        'is_active' => true,
        'price' => 1800.00,
        'name' => 'RTX 4090',
    ]);

    // CPU in price range (should NOT match — wrong category)
    Product::factory()->for($vendeur, 'seller')->create([
        'category' => ProductCategory::CPU->value,
        'is_active' => true,
        'price' => 600.00,
        'name' => 'Ryzen 7',
    ]);

    $response = $this->getJson('/api/products?category=gpu&price_min=500&price_max=1500');

    $response->assertStatus(200);

    $products = $response->json('data');
    expect(count($products))->toBe(1);
    expect($products[0]['category'])->toBe('gpu');
    expect($products[0]['price'])->toBeGreaterThanOrEqual(500);
    expect($products[0]['price'])->toBeLessThanOrEqual(1500);
});

test('search + price range combined: only products matching BOTH', function () {
    $vendeur = User::factory()->vendeur()->create();

    // Corsair under 150 (should match)
    Product::factory()->for($vendeur, 'seller')->create([
        'is_active' => true,
        'price' => 109.99,
        'name' => 'Corsair Vengeance DDR5',
    ]);

    // Corsair over 150 (should NOT match — price too high)
    Product::factory()->for($vendeur, 'seller')->create([
        'is_active' => true,
        'price' => 220.00,
        'name' => 'Corsair Dominator Platinum',
    ]);

    // Non-Corsair under 150 (should NOT match — wrong name)
    Product::factory()->for($vendeur, 'seller')->create([
        'is_active' => true,
        'price' => 59.99,
        'name' => 'Kingston Fury Beast',
    ]);

    $response = $this->getJson('/api/products?search=Corsair&price_max=150');

    $response->assertStatus(200);

    $products = $response->json('data');
    expect(count($products))->toBe(1);
    expect(str_contains(strtolower($products[0]['name']), 'corsair'))->toBeTrue();
    expect($products[0]['price'])->toBeLessThanOrEqual(150);
});

test('all three filters combined: category + price range + search', function () {
    $vendeur = User::factory()->vendeur()->create();

    // CPU, Ryzen, in price range (should match)
    Product::factory()->for($vendeur, 'seller')->create([
        'category' => ProductCategory::CPU->value,
        'is_active' => true,
        'price' => 549.99,
        'name' => 'AMD Ryzen 9 7950X',
    ]);

    // CPU, Ryzen, out of price range (should NOT match)
    Product::factory()->for($vendeur, 'seller')->create([
        'category' => ProductCategory::CPU->value,
        'is_active' => true,
        'price' => 229.99,
        'name' => 'AMD Ryzen 5 7600X',
    ]);

    // CPU, Intel, in price range (should NOT match — wrong name)
    Product::factory()->for($vendeur, 'seller')->create([
        'category' => ProductCategory::CPU->value,
        'is_active' => true,
        'price' => 589.00,
        'name' => 'Intel Core i9-14900K',
    ]);

    $response = $this->getJson('/api/products?category=cpu&price_min=400&price_max=600&search=Ryzen');

    $response->assertStatus(200);

    $products = $response->json('data');
    expect(count($products))->toBe(1);
    expect($products[0]['category'])->toBe('cpu');
    expect($products[0]['price'])->toBeGreaterThanOrEqual(400);
    expect($products[0]['price'])->toBeLessThanOrEqual(600);
    expect(str_contains(strtolower($products[0]['name']), 'ryzen'))->toBeTrue();
});

test('combined filters with no matching results returns empty array', function () {
    $vendeur = User::factory()->vendeur()->create();

    Product::factory()->for($vendeur, 'seller')->create([
        'category' => ProductCategory::CPU->value,
        'is_active' => true,
        'name' => 'AMD Ryzen 9',
    ]);

    Product::factory()->for($vendeur, 'seller')->create([
        'category' => ProductCategory::GPU->value,
        'is_active' => true,
        'name' => 'RTX 4090',
    ]);

    // GPU + search Ryzen — no GPU has "Ryzen" in name
    $response = $this->getJson('/api/products?category=gpu&search=Ryzen');

    $response->assertStatus(200);

    $products = $response->json('data');
    expect(count($products))->toBe(0);
});

// ---------------------------------------------------------------------------
// No filters — returns all active products
// ---------------------------------------------------------------------------

test('GET /api/products without filters returns all active products', function () {
    $vendeur = User::factory()->vendeur()->create();

    Product::factory()->for($vendeur, 'seller')->count(5)->create([
        'is_active' => true,
    ]);

    Product::factory()->for($vendeur, 'seller')->inactive()->count(2)->create();

    $response = $this->getJson('/api/products');

    $response->assertStatus(200);

    $products = $response->json('data');
    expect(count($products))->toBe(5);
});

// ---------------------------------------------------------------------------
// Public access — no authentication required
// ---------------------------------------------------------------------------

test('GET /api/products with filters does not require authentication', function () {
    $response = $this->getJson('/api/products?category=cpu&price_min=100&search=test');

    $response->assertStatus(200);
    expect($response->status())->not->toBe(401);
    expect($response->status())->not->toBe(403);
});

test('authenticated acheteur can use filters', function () {
    $acheteur = User::factory()->acheteur()->create();
    $vendeur = User::factory()->vendeur()->create();

    Product::factory()->for($vendeur, 'seller')->create([
        'category' => ProductCategory::RAM->value,
        'is_active' => true,
        'name' => 'Test RAM',
    ]);

    $response = $this->actingAs($acheteur, 'api')
        ->getJson('/api/products?category=ram');

    $response->assertStatus(200);

    $products = $response->json('data');
    expect(count($products))->toBe(1);
});

test('authenticated vendeur can use filters', function () {
    $vendeur = User::factory()->vendeur()->create();

    Product::factory()->for($vendeur, 'seller')->create([
        'category' => ProductCategory::GPU->value,
        'is_active' => true,
        'name' => 'Samsung Monitor',
    ]);

    $response = $this->actingAs($vendeur, 'api')
        ->getJson('/api/products?search=Samsung');

    $response->assertStatus(200);

    $products = $response->json('data');
    expect(count($products))->toBe(1);
});

// ---------------------------------------------------------------------------
// Response structure — ProductResource format
// ---------------------------------------------------------------------------

test('filtered products response matches ProductResource structure', function () {
    $vendeur = User::factory()->vendeur()->create();

    Product::factory()->for($vendeur, 'seller')->create([
        'category' => ProductCategory::CPU->value,
        'is_active' => true,
    ]);

    $response = $this->getJson('/api/products?category=cpu');

    $response->assertStatus(200)
        ->assertJsonStructure([
            'data' => [
                '*' => ['id', 'name', 'description', 'category', 'price', 'stock_quantity', 'is_active', 'photo_url', 'specs'],
            ],
        ]);
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

test('empty search string returns all active products', function () {
    $vendeur = User::factory()->vendeur()->create();

    Product::factory()->for($vendeur, 'seller')->count(3)->create([
        'is_active' => true,
    ]);

    $response = $this->getJson('/api/products?search=');

    $response->assertStatus(200);

    $products = $response->json('data');
    expect(count($products))->toBe(3);
});

test('search with only spaces returns all active products', function () {
    $vendeur = User::factory()->vendeur()->create();

    Product::factory()->for($vendeur, 'seller')->count(3)->create([
        'is_active' => true,
    ]);

    $response = $this->getJson('/api/products?search=%20%20%20');

    $response->assertStatus(200);

    $products = $response->json('data');
    expect(count($products))->toBe(3);
});

test('special characters in search do not crash the application', function () {
    $vendeur = User::factory()->vendeur()->create();

    Product::factory()->for($vendeur, 'seller')->create([
        'is_active' => true,
        'name' => 'Normal Product',
    ]);

    $response = $this->getJson('/api/products?search=' . urlencode('<script>alert("xss")</script>'));

    $response->assertStatus(200);

    $products = $response->json('data');
    expect(count($products))->toBe(0);
});

test('price_min greater than price_max returns empty results', function () {
    $vendeur = User::factory()->vendeur()->create();

    Product::factory()->for($vendeur, 'seller')->create([
        'is_active' => true,
        'price' => 500.00,
    ]);

    $response = $this->getJson('/api/products?price_min=1000&price_max=100');

    $response->assertStatus(200);

    $products = $response->json('data');
    expect(count($products))->toBe(0);
});

test('very large price_max does not filter out any products', function () {
    $vendeur = User::factory()->vendeur()->create();

    Product::factory()->for($vendeur, 'seller')->count(3)->create([
        'is_active' => true,
    ]);

    $responseAll = $this->getJson('/api/products');
    $responseFiltered = $this->getJson('/api/products?price_max=999999');

    expect(count($responseFiltered->json('data')))->toBe(count($responseAll->json('data')));
});

test('negative price_min is rejected by validation', function () {
    $response = $this->getJson('/api/products?price_min=-10');

    $response->assertStatus(422);
});

test('non-numeric price values are rejected by validation', function () {
    $response = $this->getJson('/api/products?price_min=abc');

    $response->assertStatus(422);
});
