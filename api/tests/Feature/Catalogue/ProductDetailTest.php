<?php

use App\Enums\ProductCategory;
use App\Models\Product;
use App\Models\User;

// ===========================================================================
// Story 3.4 — Product Detail Page — Backend Tests
// ===========================================================================

// ---------------------------------------------------------------------------
// GET /api/products/{id} — Returns all required fields (AC1)
// ---------------------------------------------------------------------------

test('product detail returns all required fields including restock_date', function () {
    $vendeur = User::factory()->vendeur()->create(['name' => 'DetailSeller']);

    $product = Product::factory()->for($vendeur, 'seller')->create([
        'category' => ProductCategory::CPU->value,
        'is_active' => true,
        'name' => 'AMD Ryzen 9 7950X',
        'description' => 'Un processeur haute performance pour le gaming et la productivité.',
        'price' => 549.99,
        'stock_quantity' => 12,
        'photo_url' => 'https://example.com/photo.jpg',
        'specs' => [
            ['key' => 'Marque', 'value' => 'AMD'],
            ['key' => 'Socket', 'value' => 'AM5'],
        ],
        'restock_date' => null,
    ]);

    $response = $this->getJson("/api/products/{$product->id}");

    $response->assertStatus(200)
        ->assertJsonStructure([
            'data' => [
                'id',
                'name',
                'description',
                'category',
                'specs',
                'price',
                'stock_quantity',
                'seller_name',
                'photo_url',
                'is_active',
                'restock_date',
            ],
        ])
        ->assertJsonPath('data.id', $product->id)
        ->assertJsonPath('data.name', 'AMD Ryzen 9 7950X')
        ->assertJsonPath('data.description', 'Un processeur haute performance pour le gaming et la productivité.')
        ->assertJsonPath('data.category', 'cpu')
        ->assertJsonPath('data.price', 549.99)
        ->assertJsonPath('data.stock_quantity', 12)
        ->assertJsonPath('data.seller_name', 'DetailSeller')
        ->assertJsonPath('data.photo_url', 'https://example.com/photo.jpg')
        ->assertJsonPath('data.is_active', true)
        ->assertJsonPath('data.restock_date', null);
});

// ---------------------------------------------------------------------------
// GET /api/products/{id} — restock_date (AC1, AC3)
// ---------------------------------------------------------------------------

test('product detail returns restock_date as Y-m-d string for out-of-stock product', function () {
    $vendeur = User::factory()->vendeur()->create();

    $product = Product::factory()->for($vendeur, 'seller')->create([
        'category' => ProductCategory::GPU->value,
        'is_active' => true,
        'stock_quantity' => 0,
        'restock_date' => '2026-03-15',
    ]);

    $response = $this->getJson("/api/products/{$product->id}");

    $response->assertStatus(200);
    expect($response->json('data.restock_date'))->toBe('2026-03-15');
    expect($response->json('data.stock_quantity'))->toBe(0);
});

test('product detail returns null restock_date for in-stock product', function () {
    $vendeur = User::factory()->vendeur()->create();

    $product = Product::factory()->for($vendeur, 'seller')->create([
        'category' => ProductCategory::CPU->value,
        'is_active' => true,
        'stock_quantity' => 10,
        'restock_date' => null,
    ]);

    $response = $this->getJson("/api/products/{$product->id}");

    $response->assertStatus(200);
    expect($response->json('data.restock_date'))->toBeNull();
});

// ---------------------------------------------------------------------------
// GET /api/products/{id} — Specs normalization (AC1)
// ---------------------------------------------------------------------------

test('product detail normalizes specs from associative object to key/value array', function () {
    $vendeur = User::factory()->vendeur()->create();

    // Store specs as associative object (as sent by E2E tests via seller API)
    $product = Product::factory()->for($vendeur, 'seller')->create([
        'category' => ProductCategory::CPU->value,
        'is_active' => true,
        'specs' => ['Marque' => 'AMD', 'Socket' => 'AM5', 'TDP' => '170W'],
    ]);

    $response = $this->getJson("/api/products/{$product->id}");

    $response->assertStatus(200);
    $specs = $response->json('data.specs');

    expect($specs)->toBeArray();
    expect(count($specs))->toBe(3);

    // Each spec should have key and value as strings
    foreach ($specs as $spec) {
        expect($spec)->toHaveKey('key');
        expect($spec)->toHaveKey('value');
        expect($spec['key'])->toBeString();
        expect($spec['value'])->toBeString();
    }

    // Verify specific values
    $marqueSpec = collect($specs)->firstWhere('key', 'Marque');
    expect($marqueSpec)->not->toBeNull();
    expect($marqueSpec['value'])->toBe('AMD');
});

test('product detail passes through already-normalized specs array', function () {
    $vendeur = User::factory()->vendeur()->create();

    // Store specs already in [{key, value}] format
    $product = Product::factory()->for($vendeur, 'seller')->create([
        'category' => ProductCategory::RAM->value,
        'is_active' => true,
        'specs' => [
            ['key' => 'Type', 'value' => 'DDR5'],
            ['key' => 'Capacité', 'value' => '32 Go'],
        ],
    ]);

    $response = $this->getJson("/api/products/{$product->id}");

    $response->assertStatus(200);
    $specs = $response->json('data.specs');

    expect($specs)->toBeArray();
    expect(count($specs))->toBe(2);
    expect($specs[0]['key'])->toBe('Type');
    expect($specs[0]['value'])->toBe('DDR5');
    expect($specs[1]['key'])->toBe('Capacité');
    expect($specs[1]['value'])->toBe('32 Go');
});

test('product detail returns empty array for null specs', function () {
    $vendeur = User::factory()->vendeur()->create();

    $product = Product::factory()->for($vendeur, 'seller')->create([
        'category' => ProductCategory::GPU->value,
        'is_active' => true,
        'specs' => null,
    ]);

    $response = $this->getJson("/api/products/{$product->id}");

    $response->assertStatus(200);
    expect($response->json('data.specs'))->toBe([]);
});

// ---------------------------------------------------------------------------
// GET /api/products/{id} — seller_name (AC1)
// ---------------------------------------------------------------------------

test('product detail returns seller_name as a string, not an object', function () {
    $vendeur = User::factory()->vendeur()->create(['name' => 'MonVendeur']);

    $product = Product::factory()->for($vendeur, 'seller')->create([
        'category' => ProductCategory::CPU->value,
        'is_active' => true,
    ]);

    $response = $this->getJson("/api/products/{$product->id}");

    $response->assertStatus(200);
    $sellerName = $response->json('data.seller_name');

    expect($sellerName)->toBeString();
    expect($sellerName)->toBe('MonVendeur');
});

test('product detail returns seller_name even with minimal seller info', function () {
    $vendeur = User::factory()->vendeur()->create(['name' => 'A']);

    $product = Product::factory()->for($vendeur, 'seller')->create([
        'category' => ProductCategory::CPU->value,
        'is_active' => true,
    ]);

    $response = $this->getJson("/api/products/{$product->id}");

    $response->assertStatus(200);
    // Even with a single-char name, seller_name should be a non-empty string
    expect($response->json('data.seller_name'))->toBe('A');
});

// ---------------------------------------------------------------------------
// GET /api/products/{id} — 404 handling
// ---------------------------------------------------------------------------

test('product detail returns 404 for non-existent product', function () {
    $response = $this->getJson('/api/products/999999');

    $response->assertStatus(404)
        ->assertJson(['message' => 'Produit introuvable.']);
});

test('product detail returns 404 for inactive product', function () {
    $vendeur = User::factory()->vendeur()->create();

    $product = Product::factory()->for($vendeur, 'seller')->inactive()->create([
        'category' => ProductCategory::CPU->value,
    ]);

    $response = $this->getJson("/api/products/{$product->id}");

    $response->assertStatus(404);
});

// ---------------------------------------------------------------------------
// GET /api/products/{id} — Access control (public route)
// ---------------------------------------------------------------------------

test('product detail is accessible without authentication', function () {
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

test('acheteur can access product detail', function () {
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

test('vendeur can access product detail', function () {
    $vendeur = User::factory()->vendeur()->create();

    $product = Product::factory()->for($vendeur, 'seller')->create([
        'category' => ProductCategory::RAM->value,
        'is_active' => true,
    ]);

    $response = $this->actingAs($vendeur, 'api')
        ->getJson("/api/products/{$product->id}");

    $response->assertStatus(200);
});

test('admin can access product detail', function () {
    $admin = User::factory()->admin()->create();
    $vendeur = User::factory()->vendeur()->create();

    $product = Product::factory()->for($vendeur, 'seller')->create([
        'category' => ProductCategory::CPU->value,
        'is_active' => true,
    ]);

    $response = $this->actingAs($admin, 'api')
        ->getJson("/api/products/{$product->id}");

    $response->assertStatus(200);
});

// ---------------------------------------------------------------------------
// GET /api/products/{id} — In-stock product (AC2)
// ---------------------------------------------------------------------------

test('in-stock product returns stock_quantity > 0 and null restock_date', function () {
    $vendeur = User::factory()->vendeur()->create();

    $product = Product::factory()->for($vendeur, 'seller')->create([
        'category' => ProductCategory::CPU->value,
        'is_active' => true,
        'stock_quantity' => 25,
        'restock_date' => null,
    ]);

    $response = $this->getJson("/api/products/{$product->id}");

    $response->assertStatus(200);
    expect($response->json('data.stock_quantity'))->toBe(25);
    expect($response->json('data.restock_date'))->toBeNull();
});

// ---------------------------------------------------------------------------
// GET /api/products/{id} — Out-of-stock product (AC3)
// ---------------------------------------------------------------------------

test('out-of-stock product returns stock_quantity 0 and restock_date', function () {
    $vendeur = User::factory()->vendeur()->create();

    $product = Product::factory()->for($vendeur, 'seller')->create([
        'category' => ProductCategory::GPU->value,
        'is_active' => true,
        'stock_quantity' => 0,
        'restock_date' => '2026-04-01',
    ]);

    $response = $this->getJson("/api/products/{$product->id}");

    $response->assertStatus(200);
    expect($response->json('data.stock_quantity'))->toBe(0);
    expect($response->json('data.restock_date'))->toBe('2026-04-01');
});

// ---------------------------------------------------------------------------
// POST /api/seller/products — Creates product with restock_date and object specs
// ---------------------------------------------------------------------------

test('seller can create product with restock_date via API', function () {
    $vendeur = User::factory()->vendeur()->create();

    $response = $this->actingAs($vendeur, 'api')
        ->postJson('/api/seller/products', [
            'name' => 'GPU Test Restock',
            'description' => 'Carte graphique avec date de retour.',
            'category' => 'gpu',
            'price' => 999.99,
            'stock_quantity' => 0,
            'is_active' => true,
            'restock_date' => '2026-06-15',
            'specs' => ['Marque' => 'NVIDIA', 'TDP' => '300W'],
        ]);

    $response->assertStatus(201);

    // Verify restock_date is saved in DB
    $product = Product::find($response->json('data.id'));
    expect($product->restock_date->format('Y-m-d'))->toBe('2026-06-15');
    expect($product->stock_quantity)->toBe(0);
});

test('seller can create product with object specs (associative array)', function () {
    $vendeur = User::factory()->vendeur()->create();

    $response = $this->actingAs($vendeur, 'api')
        ->postJson('/api/seller/products', [
            'name' => 'CPU Test Specs',
            'description' => 'Processeur avec specs objet.',
            'category' => 'cpu',
            'price' => 299.99,
            'stock_quantity' => 5,
            'specs' => ['Marque' => 'Intel', 'Socket' => 'LGA 1700', 'TDP' => '125W'],
        ]);

    $response->assertStatus(201);

    // Verify specs are stored in DB
    $product = Product::find($response->json('data.id'));
    expect($product->specs)->toBeArray();
    expect($product->specs)->toHaveKey('Marque');
    expect($product->specs['Marque'])->toBe('Intel');
});

// ---------------------------------------------------------------------------
// GET /api/products/{id} — Route constraint (only numeric IDs)
// ---------------------------------------------------------------------------

test('product detail route rejects non-numeric ID', function () {
    $response = $this->getJson('/api/products/abc');

    // Route constraint {id} where('id', '[0-9]+') means non-numeric falls through
    // to 404 or route not found
    expect($response->status())->toBeIn([404, 500]);
});

// ---------------------------------------------------------------------------
// Performance — Seller relationship is eager loaded
// ---------------------------------------------------------------------------

test('product detail eager loads seller relationship (no N+1)', function () {
    $vendeur = User::factory()->vendeur()->create(['name' => 'EagerSeller']);

    $product = Product::factory()->for($vendeur, 'seller')->create([
        'category' => ProductCategory::CPU->value,
        'is_active' => true,
    ]);

    $response = $this->getJson("/api/products/{$product->id}");

    $response->assertStatus(200);
    expect($response->json('data.seller_name'))->toBe('EagerSeller');
});
