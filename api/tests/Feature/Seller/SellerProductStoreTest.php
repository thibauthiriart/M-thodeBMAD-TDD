<?php

use App\Enums\ProductCategory;
use App\Models\Product;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

// ===========================================================================
// POST /api/seller/products — Create a product for the authenticated seller
// Story 2.2: Full product creation with photo, description, specs, category
// ===========================================================================

test('vendeur can create a product with all fields including photo upload', function () {
    Storage::fake('public');
    $vendeur = User::factory()->vendeur()->create();

    $response = $this->actingAs($vendeur, 'api')
        ->post('/api/seller/products', [
            'name' => 'RTX 4090 Gaming',
            'description' => 'GPU haute performance pour gaming',
            'category' => 'gpu',
            'price' => 1599.99,
            'stock_quantity' => 5,
            'specs' => json_encode([['key' => 'VRAM', 'value' => '24 Go']]),
            'photo' => UploadedFile::fake()->image('gpu.jpg', 200, 200)->size(500),
        ], [
            'Accept' => 'application/json',
            'Content-Type' => 'multipart/form-data',
        ]);

    $response->assertStatus(201)
        ->assertJsonStructure([
            'data' => ['id', 'name', 'description', 'category', 'price', 'stock_quantity', 'is_active', 'photo_url'],
        ])
        ->assertJsonPath('data.name', 'RTX 4090 Gaming')
        ->assertJsonPath('data.description', 'GPU haute performance pour gaming')
        ->assertJsonPath('data.category', 'gpu')
        ->assertJsonPath('data.price', 1599.99)
        ->assertJsonPath('data.stock_quantity', 5)
        ->assertJsonPath('data.is_active', true);

    $this->assertDatabaseHas('products', [
        'seller_id' => $vendeur->id,
        'name' => 'RTX 4090 Gaming',
        'description' => 'GPU haute performance pour gaming',
        'category' => 'gpu',
    ]);

    // Verify photo was stored
    $product = Product::where('name', 'RTX 4090 Gaming')->first();
    expect($product->photo_path)->not->toBeNull();
    Storage::disk('public')->assertExists($product->photo_path);
});

test('product is automatically assigned to the authenticated seller', function () {
    Storage::fake('public');
    $vendeur = User::factory()->vendeur()->create();

    $response = $this->actingAs($vendeur, 'api')
        ->post('/api/seller/products', [
            'name' => 'CPU Ryzen 9',
            'description' => 'Processeur AMD haute gamme',
            'category' => 'cpu',
            'price' => 499.00,
            'stock_quantity' => 12,
            'photo' => UploadedFile::fake()->image('cpu.jpg'),
        ], ['Accept' => 'application/json']);

    $response->assertStatus(201);

    $productId = $response->json('data.id');
    $product = Product::find($productId);

    expect($product)->not->toBeNull();
    expect($product->seller_id)->toBe($vendeur->id);
});

test('product is created with is_active true by default', function () {
    Storage::fake('public');
    $vendeur = User::factory()->vendeur()->create();

    $response = $this->actingAs($vendeur, 'api')
        ->post('/api/seller/products', [
            'name' => 'RAM DDR5',
            'description' => 'Mémoire vive rapide',
            'category' => 'ram',
            'price' => 149.99,
            'stock_quantity' => 20,
            'photo' => UploadedFile::fake()->image('ram.jpg'),
        ], ['Accept' => 'application/json']);

    $response->assertStatus(201)
        ->assertJsonPath('data.is_active', true);

    $this->assertDatabaseHas('products', [
        'name' => 'RAM DDR5',
        'is_active' => true,
    ]);
});

test('created product can be retrieved in seller products list', function () {
    Storage::fake('public');
    $vendeur = User::factory()->vendeur()->create();

    $createResponse = $this->actingAs($vendeur, 'api')
        ->post('/api/seller/products', [
            'name' => 'RAM DDR5 32GB',
            'description' => 'Mémoire vive 32Go',
            'category' => 'ram',
            'price' => 149.99,
            'stock_quantity' => 20,
            'photo' => UploadedFile::fake()->image('ram.jpg'),
        ], ['Accept' => 'application/json']);

    $createResponse->assertStatus(201);

    $listResponse = $this->actingAs($vendeur, 'api')
        ->getJson('/api/seller/products');

    $listResponse->assertStatus(200);
    $productNames = collect($listResponse->json('data'))->pluck('name')->toArray();
    expect($productNames)->toContain('RAM DDR5 32GB');
});

test('specs are stored as JSON and returned correctly', function () {
    Storage::fake('public');
    $vendeur = User::factory()->vendeur()->create();

    $specs = [
        ['key' => 'Processeur', 'value' => 'AMD Ryzen 9 7950X'],
        ['key' => 'Fréquence', 'value' => '4.5 GHz'],
        ['key' => 'Cores', 'value' => '16'],
    ];

    $response = $this->actingAs($vendeur, 'api')
        ->post('/api/seller/products', [
            'name' => 'Ryzen 9 7950X',
            'description' => 'Processeur 16 cœurs',
            'category' => 'cpu',
            'price' => 599.99,
            'stock_quantity' => 5,
            'specs' => json_encode($specs),
            'photo' => UploadedFile::fake()->image('cpu.jpg'),
        ], ['Accept' => 'application/json']);

    $response->assertStatus(201);

    $product = Product::where('name', 'Ryzen 9 7950X')->first();
    expect($product->specs)->toBeArray();
    expect($product->specs)->toHaveCount(3);
    expect($product->specs[0]['key'])->toBe('Processeur');
    expect($product->specs[0]['value'])->toBe('AMD Ryzen 9 7950X');
});

test('stock_quantity 0 is accepted', function () {
    Storage::fake('public');
    $vendeur = User::factory()->vendeur()->create();

    $response = $this->actingAs($vendeur, 'api')
        ->post('/api/seller/products', [
            'name' => 'Produit épuisé',
            'description' => 'Pas de stock',
            'category' => 'gpu',
            'price' => 999.99,
            'stock_quantity' => 0,
            'photo' => UploadedFile::fake()->image('gpu.jpg'),
        ], ['Accept' => 'application/json']);

    $response->assertStatus(201)
        ->assertJsonPath('data.stock_quantity', 0);

    $this->assertDatabaseHas('products', [
        'name' => 'Produit épuisé',
        'stock_quantity' => 0,
    ]);
});

test('all 8 categories are accepted', function () {
    Storage::fake('public');
    $vendeur = User::factory()->vendeur()->create();

    foreach (ProductCategory::values() as $category) {
        $response = $this->actingAs($vendeur, 'api')
            ->post('/api/seller/products', [
                'name' => "Product {$category}",
                'description' => "Test category {$category}",
                'category' => $category,
                'price' => 49.99,
                'stock_quantity' => 10,
                'photo' => UploadedFile::fake()->image('test.jpg'),
            ], ['Accept' => 'application/json']);

        $response->assertStatus(201);

        $this->assertDatabaseHas('products', [
            'name' => "Product {$category}",
            'category' => $category,
        ]);
    }
});

test('photo is stored on public disk', function () {
    Storage::fake('public');
    $vendeur = User::factory()->vendeur()->create();

    $response = $this->actingAs($vendeur, 'api')
        ->post('/api/seller/products', [
            'name' => 'Photo test product',
            'description' => 'Testing photo storage',
            'category' => 'cpu',
            'price' => 100,
            'stock_quantity' => 1,
            'photo' => UploadedFile::fake()->image('test.png', 200, 200),
        ], ['Accept' => 'application/json']);

    $response->assertStatus(201);

    $product = Product::where('name', 'Photo test product')->first();
    expect($product->photo_path)->not->toBeNull();
    expect($product->photo_path)->toContain('products/');
    Storage::disk('public')->assertExists($product->photo_path);
});

test('ProductResource returns photo_url from photo_path', function () {
    Storage::fake('public');
    $vendeur = User::factory()->vendeur()->create();

    $response = $this->actingAs($vendeur, 'api')
        ->post('/api/seller/products', [
            'name' => 'Photo URL test',
            'description' => 'Testing photo URL in resource',
            'category' => 'gpu',
            'price' => 200,
            'stock_quantity' => 5,
            'photo' => UploadedFile::fake()->image('gpu.png'),
        ], ['Accept' => 'application/json']);

    $response->assertStatus(201);
    expect($response->json('data.photo_url'))->not->toBeNull();
    expect($response->json('data.photo_url'))->toBeString();
});

// ===========================================================================
// Validation — Missing/Invalid fields
// ===========================================================================

test('create product without name returns 422', function () {
    Storage::fake('public');
    $vendeur = User::factory()->vendeur()->create();

    $response = $this->actingAs($vendeur, 'api')
        ->post('/api/seller/products', [
            'description' => 'Test',
            'category' => 'cpu',
            'price' => 10,
            'stock_quantity' => 5,
            'photo' => UploadedFile::fake()->image('test.jpg'),
        ], ['Accept' => 'application/json']);

    $response->assertStatus(422)
        ->assertJsonValidationErrors(['name']);
});

test('create product without description returns 422', function () {
    Storage::fake('public');
    $vendeur = User::factory()->vendeur()->create();

    $response = $this->actingAs($vendeur, 'api')
        ->post('/api/seller/products', [
            'name' => 'Test',
            'category' => 'cpu',
            'price' => 10,
            'stock_quantity' => 5,
            'photo' => UploadedFile::fake()->image('test.jpg'),
        ], ['Accept' => 'application/json']);

    $response->assertStatus(422)
        ->assertJsonValidationErrors(['description']);
});

test('create product without category returns 422', function () {
    Storage::fake('public');
    $vendeur = User::factory()->vendeur()->create();

    $response = $this->actingAs($vendeur, 'api')
        ->post('/api/seller/products', [
            'name' => 'Test',
            'description' => 'Test description',
            'price' => 10,
            'stock_quantity' => 5,
            'photo' => UploadedFile::fake()->image('test.jpg'),
        ], ['Accept' => 'application/json']);

    $response->assertStatus(422)
        ->assertJsonValidationErrors(['category']);
});

test('create product with invalid category returns 422', function () {
    Storage::fake('public');
    $vendeur = User::factory()->vendeur()->create();

    $response = $this->actingAs($vendeur, 'api')
        ->post('/api/seller/products', [
            'name' => 'Test',
            'description' => 'Test description',
            'category' => 'invalid_category',
            'price' => 10,
            'stock_quantity' => 5,
            'photo' => UploadedFile::fake()->image('test.jpg'),
        ], ['Accept' => 'application/json']);

    $response->assertStatus(422)
        ->assertJsonValidationErrors(['category']);
});

test('create product without price returns 422', function () {
    Storage::fake('public');
    $vendeur = User::factory()->vendeur()->create();

    $response = $this->actingAs($vendeur, 'api')
        ->post('/api/seller/products', [
            'name' => 'Test',
            'description' => 'Test description',
            'category' => 'cpu',
            'stock_quantity' => 5,
            'photo' => UploadedFile::fake()->image('test.jpg'),
        ], ['Accept' => 'application/json']);

    $response->assertStatus(422)
        ->assertJsonValidationErrors(['price']);
});

test('create product without stock_quantity returns 422', function () {
    Storage::fake('public');
    $vendeur = User::factory()->vendeur()->create();

    $response = $this->actingAs($vendeur, 'api')
        ->post('/api/seller/products', [
            'name' => 'Test',
            'description' => 'Test description',
            'category' => 'cpu',
            'price' => 10,
            'photo' => UploadedFile::fake()->image('test.jpg'),
        ], ['Accept' => 'application/json']);

    $response->assertStatus(422)
        ->assertJsonValidationErrors(['stock_quantity']);
});

test('create product without photo returns 422', function () {
    $vendeur = User::factory()->vendeur()->create();

    $response = $this->actingAs($vendeur, 'api')
        ->postJson('/api/seller/products', [
            'name' => 'Test',
            'description' => 'Test description',
            'category' => 'cpu',
            'price' => 10,
            'stock_quantity' => 5,
        ]);

    $response->assertStatus(422)
        ->assertJsonValidationErrors(['photo']);
});

test('create product with negative price returns 422', function () {
    Storage::fake('public');
    $vendeur = User::factory()->vendeur()->create();

    $response = $this->actingAs($vendeur, 'api')
        ->post('/api/seller/products', [
            'name' => 'Test',
            'description' => 'Test description',
            'category' => 'cpu',
            'price' => -5,
            'stock_quantity' => 10,
            'photo' => UploadedFile::fake()->image('test.jpg'),
        ], ['Accept' => 'application/json']);

    $response->assertStatus(422)
        ->assertJsonValidationErrors(['price']);
});

test('create product with price 0 returns 422', function () {
    Storage::fake('public');
    $vendeur = User::factory()->vendeur()->create();

    $response = $this->actingAs($vendeur, 'api')
        ->post('/api/seller/products', [
            'name' => 'Test',
            'description' => 'Test description',
            'category' => 'cpu',
            'price' => 0,
            'stock_quantity' => 10,
            'photo' => UploadedFile::fake()->image('test.jpg'),
        ], ['Accept' => 'application/json']);

    $response->assertStatus(422)
        ->assertJsonValidationErrors(['price']);
});

test('create product with negative stock returns 422', function () {
    Storage::fake('public');
    $vendeur = User::factory()->vendeur()->create();

    $response = $this->actingAs($vendeur, 'api')
        ->post('/api/seller/products', [
            'name' => 'Test',
            'description' => 'Test description',
            'category' => 'cpu',
            'price' => 10,
            'stock_quantity' => -1,
            'photo' => UploadedFile::fake()->image('test.jpg'),
        ], ['Accept' => 'application/json']);

    $response->assertStatus(422)
        ->assertJsonValidationErrors(['stock_quantity']);
});

test('create product with photo exceeding 2MB returns 422', function () {
    Storage::fake('public');
    $vendeur = User::factory()->vendeur()->create();

    $response = $this->actingAs($vendeur, 'api')
        ->post('/api/seller/products', [
            'name' => 'Test',
            'description' => 'Test description',
            'category' => 'cpu',
            'price' => 100,
            'stock_quantity' => 10,
            'photo' => UploadedFile::fake()->image('huge.jpg')->size(2100),
        ], ['Accept' => 'application/json']);

    $response->assertStatus(422)
        ->assertJsonValidationErrors(['photo']);
});

test('create product with empty body returns 422 with all required field errors', function () {
    $vendeur = User::factory()->vendeur()->create();

    $response = $this->actingAs($vendeur, 'api')
        ->postJson('/api/seller/products', []);

    $response->assertStatus(422)
        ->assertJsonValidationErrors(['name', 'description', 'category', 'price', 'stock_quantity', 'photo']);
});

// ===========================================================================
// Authentication & Authorization
// ===========================================================================

test('unauthenticated user cannot create product (401)', function () {
    $response = $this->postJson('/api/seller/products', [
        'name' => 'Test',
        'description' => 'Test',
        'category' => 'cpu',
        'price' => 10,
        'stock_quantity' => 5,
    ]);

    $response->assertStatus(401);
});

test('acheteur cannot create product (403)', function () {
    Storage::fake('public');
    $acheteur = User::factory()->acheteur()->create();

    $response = $this->actingAs($acheteur, 'api')
        ->post('/api/seller/products', [
            'name' => 'Test',
            'description' => 'Test',
            'category' => 'cpu',
            'price' => 10,
            'stock_quantity' => 5,
            'photo' => UploadedFile::fake()->image('test.jpg'),
        ], ['Accept' => 'application/json']);

    $response->assertStatus(403);

    $this->assertDatabaseMissing('products', ['name' => 'Test']);
});

test('admin can create product (vendeur+admin access)', function () {
    Storage::fake('public');
    $admin = User::factory()->admin()->create();

    $response = $this->actingAs($admin, 'api')
        ->post('/api/seller/products', [
            'name' => 'Admin Product',
            'description' => 'Created by admin',
            'category' => 'gpu',
            'price' => 299.99,
            'stock_quantity' => 3,
            'photo' => UploadedFile::fake()->image('test.jpg'),
        ], ['Accept' => 'application/json']);

    $response->assertStatus(201);
    $this->assertDatabaseHas('products', [
        'seller_id' => $admin->id,
        'name' => 'Admin Product',
    ]);
});

// ===========================================================================
// Seller isolation
// ===========================================================================

test('product created by vendeur1 is not visible to vendeur2', function () {
    Storage::fake('public');
    $vendeur1 = User::factory()->vendeur()->create();
    $vendeur2 = User::factory()->vendeur()->create();

    // Create product as vendeur1
    $this->actingAs($vendeur1, 'api')
        ->post('/api/seller/products', [
            'name' => 'Vendeur1 Only Product',
            'description' => 'Should not be visible to vendeur2',
            'category' => 'cpu',
            'price' => 299.99,
            'stock_quantity' => 5,
            'photo' => UploadedFile::fake()->image('test.jpg'),
        ], ['Accept' => 'application/json'])
        ->assertStatus(201);

    // List as vendeur2
    $listResponse = $this->actingAs($vendeur2, 'api')
        ->getJson('/api/seller/products');

    $listResponse->assertStatus(200);
    $productNames = collect($listResponse->json('data'))->pluck('name')->toArray();
    expect($productNames)->not->toContain('Vendeur1 Only Product');
});
