<?php

use App\Models\Product;
use App\Models\User;
use Illuminate\Support\Facades\Storage;
use Illuminate\Http\UploadedFile;

// ===========================================================================
// GET /api/seller/products/{id} — Show a single product for the authenticated seller
// Story 2.3: Edit Product Listing (AC1 — backend for pre-filling edit form)
// ===========================================================================

test('vendeur can view their own product via show endpoint', function () {
    Storage::fake('public');
    $vendeur = User::factory()->vendeur()->create();
    $product = Product::factory()->for($vendeur, 'seller')->create([
        'name' => 'RTX 4090',
        'description' => 'GPU haute performance',
        'category' => 'gpu',
        'price' => 1599.99,
        'stock_quantity' => 5,
    ]);

    $response = $this->actingAs($vendeur, 'api')
        ->getJson("/api/seller/products/{$product->id}");

    $response->assertStatus(200)
        ->assertJsonStructure([
            'data' => ['id', 'name', 'description', 'category', 'price', 'stock_quantity', 'is_active', 'photo_url', 'specs'],
        ])
        ->assertJsonPath('data.id', $product->id)
        ->assertJsonPath('data.name', 'RTX 4090')
        ->assertJsonPath('data.description', 'GPU haute performance')
        ->assertJsonPath('data.category', 'gpu');
});

test('show endpoint returns correct type casting', function () {
    Storage::fake('public');
    $vendeur = User::factory()->vendeur()->create();
    $product = Product::factory()->for($vendeur, 'seller')->create([
        'price' => 299.99,
        'stock_quantity' => 15,
        'is_active' => true,
    ]);

    $response = $this->actingAs($vendeur, 'api')
        ->getJson("/api/seller/products/{$product->id}");

    $response->assertStatus(200);

    $data = $response->json('data');
    expect($data['price'])->toBeFloat();
    expect($data['stock_quantity'])->toBeInt();
    expect($data['is_active'])->toBeBool();
});

test('show endpoint returns specs as array', function () {
    Storage::fake('public');
    $vendeur = User::factory()->vendeur()->create();
    $specs = [['key' => 'VRAM', 'value' => '24 Go'], ['key' => 'TDP', 'value' => '450W']];
    $product = Product::factory()->for($vendeur, 'seller')->create([
        'specs' => $specs,
    ]);

    $response = $this->actingAs($vendeur, 'api')
        ->getJson("/api/seller/products/{$product->id}");

    $response->assertStatus(200);
    $data = $response->json('data');
    expect($data['specs'])->toBeArray();
    expect($data['specs'])->toHaveCount(2);
    expect($data['specs'][0]['key'])->toBe('VRAM');
    expect($data['specs'][0]['value'])->toBe('24 Go');
});

test('show endpoint returns photo_url from photo_path', function () {
    Storage::fake('public');
    $vendeur = User::factory()->vendeur()->create();

    // Create product with photo
    $photo = UploadedFile::fake()->image('test.png');
    $photoPath = $photo->store('products', 'public');

    $product = Product::factory()->for($vendeur, 'seller')->create([
        'photo_path' => $photoPath,
    ]);

    $response = $this->actingAs($vendeur, 'api')
        ->getJson("/api/seller/products/{$product->id}");

    $response->assertStatus(200);
    expect($response->json('data.photo_url'))->not->toBeNull();
    expect($response->json('data.photo_url'))->toBeString();
});

test('show endpoint does not expose seller_id or timestamps', function () {
    Storage::fake('public');
    $vendeur = User::factory()->vendeur()->create();
    $product = Product::factory()->for($vendeur, 'seller')->create();

    $response = $this->actingAs($vendeur, 'api')
        ->getJson("/api/seller/products/{$product->id}");

    $response->assertStatus(200);
    $data = $response->json('data');
    expect($data)->not->toHaveKey('seller_id');
    expect($data)->not->toHaveKey('created_at');
    expect($data)->not->toHaveKey('updated_at');
});

// ===========================================================================
// Ownership check (NFR11)
// ===========================================================================

test('vendeur cannot view another vendeur\'s product (403)', function () {
    Storage::fake('public');
    $vendeur1 = User::factory()->vendeur()->create();
    $vendeur2 = User::factory()->vendeur()->create();

    $product = Product::factory()->for($vendeur1, 'seller')->create();

    $response = $this->actingAs($vendeur2, 'api')
        ->getJson("/api/seller/products/{$product->id}");

    $response->assertStatus(403);
});

test('show returns 403 for non-existent product', function () {
    $vendeur = User::factory()->vendeur()->create();

    $response = $this->actingAs($vendeur, 'api')
        ->getJson('/api/seller/products/999999');

    $response->assertStatus(403);
});

// ===========================================================================
// Authentication & Authorization
// ===========================================================================

test('unauthenticated user cannot view product (401)', function () {
    $response = $this->getJson('/api/seller/products/1');

    $response->assertStatus(401);
});

test('acheteur cannot view seller product (403)', function () {
    Storage::fake('public');
    $acheteur = User::factory()->acheteur()->create();
    $vendeur = User::factory()->vendeur()->create();
    $product = Product::factory()->for($vendeur, 'seller')->create();

    $response = $this->actingAs($acheteur, 'api')
        ->getJson("/api/seller/products/{$product->id}");

    $response->assertStatus(403);
});

test('admin can view product via show endpoint', function () {
    Storage::fake('public');
    $admin = User::factory()->admin()->create();
    $product = Product::factory()->for($admin, 'seller')->create([
        'name' => 'Admin Product Show',
    ]);

    $response = $this->actingAs($admin, 'api')
        ->getJson("/api/seller/products/{$product->id}");

    $response->assertStatus(200)
        ->assertJsonPath('data.name', 'Admin Product Show');
});
