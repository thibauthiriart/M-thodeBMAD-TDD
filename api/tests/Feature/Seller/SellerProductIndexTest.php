<?php

use App\Models\Product;
use App\Models\User;

// ===========================================================================
// GET /api/seller/products — List seller's products
// ===========================================================================

test('vendeur can list their own products', function () {
    $vendeur = User::factory()->vendeur()->create();
    $products = Product::factory()->count(3)->create(['seller_id' => $vendeur->id]);

    $response = $this->actingAs($vendeur, 'api')
        ->getJson('/api/seller/products');

    $response->assertStatus(200)
        ->assertJsonCount(3, 'data');
});

test('vendeur sees only their own products (NFR11)', function () {
    $vendeur1 = User::factory()->vendeur()->create();
    $vendeur2 = User::factory()->vendeur()->create();

    Product::factory()->count(2)->create(['seller_id' => $vendeur1->id]);
    Product::factory()->count(3)->create(['seller_id' => $vendeur2->id]);

    $response = $this->actingAs($vendeur1, 'api')
        ->getJson('/api/seller/products');

    $response->assertStatus(200)
        ->assertJsonCount(2, 'data');

    // Verify all returned products belong to vendeur1
    $productIds = collect($response->json('data'))->pluck('id');
    $vendeur1ProductIds = Product::where('seller_id', $vendeur1->id)->pluck('id');
    expect($productIds->toArray())->toEqualCanonicalizing($vendeur1ProductIds->toArray());
});

test('ProductResource returns all required fields', function () {
    $vendeur = User::factory()->vendeur()->create();
    Product::factory()->create([
        'seller_id' => $vendeur->id,
        'name' => 'Test GPU RTX 4090',
        'photo_url' => 'https://example.com/gpu.jpg',
        'price' => 1599.99,
        'stock_quantity' => 5,
        'is_active' => true,
    ]);

    $response = $this->actingAs($vendeur, 'api')
        ->getJson('/api/seller/products');

    $response->assertStatus(200)
        ->assertJsonStructure([
            'data' => [
                [
                    'id',
                    'name',
                    'photo_url',
                    'price',
                    'stock_quantity',
                    'is_active',
                ],
            ],
        ]);

    $product = $response->json('data.0');
    expect($product['name'])->toBe('Test GPU RTX 4090');
    expect($product['photo_url'])->toBe('https://example.com/gpu.jpg');
    expect($product['price'])->toBe(1599.99);
    expect($product['stock_quantity'])->toBe(5);
    expect($product['is_active'])->toBe(true);
});

test('price is returned as float number', function () {
    $vendeur = User::factory()->vendeur()->create();
    Product::factory()->create([
        'seller_id' => $vendeur->id,
        'price' => 42.50,
    ]);

    $response = $this->actingAs($vendeur, 'api')
        ->getJson('/api/seller/products');

    $response->assertStatus(200);
    $price = $response->json('data.0.price');
    expect($price)->toBeFloat();
    expect($price)->toBe(42.50);
});

test('is_active is returned as boolean', function () {
    $vendeur = User::factory()->vendeur()->create();
    Product::factory()->create([
        'seller_id' => $vendeur->id,
        'is_active' => false,
    ]);

    $response = $this->actingAs($vendeur, 'api')
        ->getJson('/api/seller/products');

    $response->assertStatus(200);
    $isActive = $response->json('data.0.is_active');
    expect($isActive)->toBeBool();
    expect($isActive)->toBe(false);
});

test('stock_quantity is returned as integer', function () {
    $vendeur = User::factory()->vendeur()->create();
    Product::factory()->create([
        'seller_id' => $vendeur->id,
        'stock_quantity' => 25,
    ]);

    $response = $this->actingAs($vendeur, 'api')
        ->getJson('/api/seller/products');

    $response->assertStatus(200);
    $stock = $response->json('data.0.stock_quantity');
    expect($stock)->toBeInt();
    expect($stock)->toBe(25);
});

test('vendeur with no products gets empty array', function () {
    $vendeur = User::factory()->vendeur()->create();

    $response = $this->actingAs($vendeur, 'api')
        ->getJson('/api/seller/products');

    $response->assertStatus(200)
        ->assertJsonCount(0, 'data')
        ->assertJson(['data' => []]);
});

test('photo_url can be null', function () {
    $vendeur = User::factory()->vendeur()->create();
    Product::factory()->withoutPhoto()->create(['seller_id' => $vendeur->id]);

    $response = $this->actingAs($vendeur, 'api')
        ->getJson('/api/seller/products');

    $response->assertStatus(200);
    expect($response->json('data.0.photo_url'))->toBeNull();
});

test('products are ordered by creation date descending', function () {
    $vendeur = User::factory()->vendeur()->create();

    $product1 = Product::factory()->create([
        'seller_id' => $vendeur->id,
        'name' => 'First',
        'created_at' => now()->subHours(2),
    ]);
    $product2 = Product::factory()->create([
        'seller_id' => $vendeur->id,
        'name' => 'Second',
        'created_at' => now()->subHour(),
    ]);
    $product3 = Product::factory()->create([
        'seller_id' => $vendeur->id,
        'name' => 'Third',
        'created_at' => now(),
    ]);

    $response = $this->actingAs($vendeur, 'api')
        ->getJson('/api/seller/products');

    $response->assertStatus(200);
    $names = collect($response->json('data'))->pluck('name')->toArray();
    expect($names)->toBe(['Third', 'Second', 'First']);
});

// ===========================================================================
// Authentication & Authorization
// ===========================================================================

test('unauthenticated user gets 401', function () {
    $response = $this->getJson('/api/seller/products');

    $response->assertStatus(401);
});

test('acheteur gets 403 when accessing seller products', function () {
    $acheteur = User::factory()->acheteur()->create();

    $response = $this->actingAs($acheteur, 'api')
        ->getJson('/api/seller/products');

    $response->assertStatus(403);
});

test('admin can access seller products endpoint', function () {
    $admin = User::factory()->admin()->create();
    Product::factory()->count(2)->create(['seller_id' => $admin->id]);

    $response = $this->actingAs($admin, 'api')
        ->getJson('/api/seller/products');

    $response->assertStatus(200);
});

// ===========================================================================
// ProductResource does NOT leak sensitive fields
// ===========================================================================

test('product response does not expose seller_id or timestamps', function () {
    $vendeur = User::factory()->vendeur()->create();
    Product::factory()->create(['seller_id' => $vendeur->id]);

    $response = $this->actingAs($vendeur, 'api')
        ->getJson('/api/seller/products');

    $response->assertStatus(200);
    $product = $response->json('data.0');

    expect($product)->not->toHaveKey('seller_id');
    expect($product)->not->toHaveKey('created_at');
    expect($product)->not->toHaveKey('updated_at');
});
