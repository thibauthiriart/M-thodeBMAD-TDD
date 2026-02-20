<?php

use App\Enums\ProductCategory;
use App\Models\Product;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

// ===========================================================================
// PUT /api/seller/products/{id} — Update a product for the authenticated seller
// Story 2.3: Edit Product Listing (AC2 — successful update, AC3 — ownership)
// ===========================================================================

// ---------------------------------------------------------------------------
// Happy path — Successful update
// ---------------------------------------------------------------------------

test('vendeur can update product name', function () {
    Storage::fake('public');
    $vendeur = User::factory()->vendeur()->create();
    $product = Product::factory()->for($vendeur, 'seller')->create([
        'name' => 'Original Name',
        'description' => 'Description',
        'category' => 'cpu',
        'price' => 299.99,
        'stock_quantity' => 10,
    ]);

    $response = $this->actingAs($vendeur, 'api')
        ->put("/api/seller/products/{$product->id}", [
            'name' => 'Updated Name',
            'description' => 'Description',
            'category' => 'cpu',
            'price' => 299.99,
            'stock_quantity' => 10,
        ], ['Accept' => 'application/json']);

    $response->assertStatus(200)
        ->assertJsonPath('data.name', 'Updated Name')
        ->assertJsonPath('data.id', $product->id);

    $this->assertDatabaseHas('products', [
        'id' => $product->id,
        'name' => 'Updated Name',
    ]);
});

test('vendeur can update product description', function () {
    Storage::fake('public');
    $vendeur = User::factory()->vendeur()->create();
    $product = Product::factory()->for($vendeur, 'seller')->create([
        'name' => 'Test',
        'description' => 'Original',
        'category' => 'cpu',
        'price' => 100,
        'stock_quantity' => 5,
    ]);

    $response = $this->actingAs($vendeur, 'api')
        ->put("/api/seller/products/{$product->id}", [
            'name' => 'Test',
            'description' => 'Updated description',
            'category' => 'cpu',
            'price' => 100,
            'stock_quantity' => 5,
        ], ['Accept' => 'application/json']);

    $response->assertStatus(200);
    $this->assertDatabaseHas('products', [
        'id' => $product->id,
        'description' => 'Updated description',
    ]);
});

test('vendeur can update product price', function () {
    Storage::fake('public');
    $vendeur = User::factory()->vendeur()->create();
    $product = Product::factory()->for($vendeur, 'seller')->create([
        'name' => 'Test',
        'description' => 'Desc',
        'category' => 'cpu',
        'price' => 100,
        'stock_quantity' => 5,
    ]);

    $response = $this->actingAs($vendeur, 'api')
        ->put("/api/seller/products/{$product->id}", [
            'name' => 'Test',
            'description' => 'Desc',
            'category' => 'cpu',
            'price' => 349.99,
            'stock_quantity' => 5,
        ], ['Accept' => 'application/json']);

    $response->assertStatus(200)
        ->assertJsonPath('data.price', 349.99);

    $product->refresh();
    expect((float) $product->price)->toBe(349.99);
});

test('vendeur can update product stock quantity', function () {
    Storage::fake('public');
    $vendeur = User::factory()->vendeur()->create();
    $product = Product::factory()->for($vendeur, 'seller')->create([
        'name' => 'Test',
        'description' => 'Desc',
        'category' => 'cpu',
        'price' => 100,
        'stock_quantity' => 5,
    ]);

    $response = $this->actingAs($vendeur, 'api')
        ->put("/api/seller/products/{$product->id}", [
            'name' => 'Test',
            'description' => 'Desc',
            'category' => 'cpu',
            'price' => 100,
            'stock_quantity' => 99,
        ], ['Accept' => 'application/json']);

    $response->assertStatus(200)
        ->assertJsonPath('data.stock_quantity', 99);

    $this->assertDatabaseHas('products', [
        'id' => $product->id,
        'stock_quantity' => 99,
    ]);
});

test('vendeur can update product category', function () {
    Storage::fake('public');
    $vendeur = User::factory()->vendeur()->create();
    $product = Product::factory()->for($vendeur, 'seller')->create([
        'name' => 'Test',
        'description' => 'Desc',
        'category' => 'cpu',
        'price' => 100,
        'stock_quantity' => 5,
    ]);

    $response = $this->actingAs($vendeur, 'api')
        ->put("/api/seller/products/{$product->id}", [
            'name' => 'Test',
            'description' => 'Desc',
            'category' => 'gpu',
            'price' => 100,
            'stock_quantity' => 5,
        ], ['Accept' => 'application/json']);

    $response->assertStatus(200)
        ->assertJsonPath('data.category', 'gpu');

    $this->assertDatabaseHas('products', [
        'id' => $product->id,
        'category' => 'gpu',
    ]);
});

test('vendeur can update product specs', function () {
    Storage::fake('public');
    $vendeur = User::factory()->vendeur()->create();
    $product = Product::factory()->for($vendeur, 'seller')->create([
        'name' => 'Test',
        'description' => 'Desc',
        'category' => 'cpu',
        'price' => 100,
        'stock_quantity' => 5,
        'specs' => [['key' => 'Old', 'value' => 'Spec']],
    ]);

    $newSpecs = [
        ['key' => 'TDP', 'value' => '105W'],
        ['key' => 'Architecture', 'value' => 'Zen 4'],
    ];

    $response = $this->actingAs($vendeur, 'api')
        ->put("/api/seller/products/{$product->id}", [
            'name' => 'Test',
            'description' => 'Desc',
            'category' => 'cpu',
            'price' => 100,
            'stock_quantity' => 5,
            'specs' => json_encode($newSpecs),
        ], ['Accept' => 'application/json']);

    $response->assertStatus(200);

    $product->refresh();
    expect($product->specs)->toBeArray();
    expect($product->specs)->toHaveCount(2);
    expect($product->specs[0]['key'])->toBe('TDP');
    expect($product->specs[1]['value'])->toBe('Zen 4');
});

test('vendeur can update multiple fields at once', function () {
    Storage::fake('public');
    $vendeur = User::factory()->vendeur()->create();
    $product = Product::factory()->for($vendeur, 'seller')->create([
        'name' => 'Original',
        'description' => 'Original desc',
        'category' => 'cpu',
        'price' => 100,
        'stock_quantity' => 5,
    ]);

    $response = $this->actingAs($vendeur, 'api')
        ->put("/api/seller/products/{$product->id}", [
            'name' => 'New Name',
            'description' => 'New description',
            'category' => 'ram',
            'price' => 249.99,
            'stock_quantity' => 50,
            'specs' => json_encode([['key' => 'Capacité', 'value' => '32 Go']]),
        ], ['Accept' => 'application/json']);

    $response->assertStatus(200);

    $product->refresh();
    expect($product->name)->toBe('New Name');
    expect($product->description)->toBe('New description');
    expect($product->category)->toBe(ProductCategory::RAM);
    expect((float) $product->price)->toBe(249.99);
    expect($product->stock_quantity)->toBe(50);
    expect($product->specs[0]['key'])->toBe('Capacité');
});

test('update returns ProductResource structure', function () {
    Storage::fake('public');
    $vendeur = User::factory()->vendeur()->create();
    $product = Product::factory()->for($vendeur, 'seller')->create([
        'name' => 'Test',
        'description' => 'Desc',
        'category' => 'cpu',
        'price' => 100,
        'stock_quantity' => 5,
    ]);

    $response = $this->actingAs($vendeur, 'api')
        ->put("/api/seller/products/{$product->id}", [
            'name' => 'Updated',
            'description' => 'Desc',
            'category' => 'cpu',
            'price' => 100,
            'stock_quantity' => 5,
        ], ['Accept' => 'application/json']);

    $response->assertStatus(200)
        ->assertJsonStructure([
            'data' => ['id', 'name', 'description', 'category', 'price', 'stock_quantity', 'is_active', 'photo_url', 'specs'],
        ]);
});

// ---------------------------------------------------------------------------
// Photo handling on update
// ---------------------------------------------------------------------------

test('update without photo keeps original photo_path', function () {
    Storage::fake('public');
    $vendeur = User::factory()->vendeur()->create();

    $photo = UploadedFile::fake()->image('original.jpg');
    $photoPath = $photo->store('products', 'public');

    $product = Product::factory()->for($vendeur, 'seller')->create([
        'name' => 'Test',
        'description' => 'Desc',
        'category' => 'cpu',
        'price' => 100,
        'stock_quantity' => 5,
        'photo_path' => $photoPath,
    ]);

    $response = $this->actingAs($vendeur, 'api')
        ->put("/api/seller/products/{$product->id}", [
            'name' => 'Updated Name',
            'description' => 'Desc',
            'category' => 'cpu',
            'price' => 100,
            'stock_quantity' => 5,
        ], ['Accept' => 'application/json']);

    $response->assertStatus(200);

    $product->refresh();
    expect($product->photo_path)->toBe($photoPath);
});

test('update with new photo replaces photo_path', function () {
    Storage::fake('public');
    $vendeur = User::factory()->vendeur()->create();

    $originalPhoto = UploadedFile::fake()->image('original.jpg');
    $originalPhotoPath = $originalPhoto->store('products', 'public');

    $product = Product::factory()->for($vendeur, 'seller')->create([
        'name' => 'Test',
        'description' => 'Desc',
        'category' => 'cpu',
        'price' => 100,
        'stock_quantity' => 5,
        'photo_path' => $originalPhotoPath,
    ]);

    $response = $this->actingAs($vendeur, 'api')
        ->put("/api/seller/products/{$product->id}", [
            'name' => 'Test',
            'description' => 'Desc',
            'category' => 'cpu',
            'price' => 100,
            'stock_quantity' => 5,
            'photo' => UploadedFile::fake()->image('new.jpg'),
        ], ['Accept' => 'application/json']);

    $response->assertStatus(200);

    $product->refresh();
    expect($product->photo_path)->not->toBe($originalPhotoPath);
    expect($product->photo_path)->not->toBeNull();
    Storage::disk('public')->assertExists($product->photo_path);
});

test('old photo is deleted from disk when replaced', function () {
    Storage::fake('public');
    $vendeur = User::factory()->vendeur()->create();

    $originalPhoto = UploadedFile::fake()->image('original.jpg');
    $originalPhotoPath = $originalPhoto->store('products', 'public');

    $product = Product::factory()->for($vendeur, 'seller')->create([
        'name' => 'Test',
        'description' => 'Desc',
        'category' => 'cpu',
        'price' => 100,
        'stock_quantity' => 5,
        'photo_path' => $originalPhotoPath,
    ]);

    $this->actingAs($vendeur, 'api')
        ->put("/api/seller/products/{$product->id}", [
            'name' => 'Test',
            'description' => 'Desc',
            'category' => 'cpu',
            'price' => 100,
            'stock_quantity' => 5,
            'photo' => UploadedFile::fake()->image('new.jpg'),
        ], ['Accept' => 'application/json'])
        ->assertStatus(200);

    Storage::disk('public')->assertMissing($originalPhotoPath);
});

// ---------------------------------------------------------------------------
// Data integrity
// ---------------------------------------------------------------------------

test('product seller_id does not change after update', function () {
    Storage::fake('public');
    $vendeur = User::factory()->vendeur()->create();
    $product = Product::factory()->for($vendeur, 'seller')->create([
        'name' => 'Test',
        'description' => 'Desc',
        'category' => 'cpu',
        'price' => 100,
        'stock_quantity' => 5,
    ]);

    $this->actingAs($vendeur, 'api')
        ->put("/api/seller/products/{$product->id}", [
            'name' => 'Updated',
            'description' => 'Desc',
            'category' => 'cpu',
            'price' => 100,
            'stock_quantity' => 5,
        ], ['Accept' => 'application/json'])
        ->assertStatus(200);

    $product->refresh();
    expect($product->seller_id)->toBe($vendeur->id);
});

test('is_active is preserved after update when not specified', function () {
    Storage::fake('public');
    $vendeur = User::factory()->vendeur()->create();
    $product = Product::factory()->for($vendeur, 'seller')->create([
        'name' => 'Test',
        'description' => 'Desc',
        'category' => 'cpu',
        'price' => 100,
        'stock_quantity' => 5,
        'is_active' => true,
    ]);

    $this->actingAs($vendeur, 'api')
        ->put("/api/seller/products/{$product->id}", [
            'name' => 'Updated',
            'description' => 'Desc',
            'category' => 'cpu',
            'price' => 100,
            'stock_quantity' => 5,
        ], ['Accept' => 'application/json'])
        ->assertStatus(200);

    $product->refresh();
    expect($product->is_active)->toBeTrue();
});

test('updated_at timestamp changes after update', function () {
    Storage::fake('public');
    $vendeur = User::factory()->vendeur()->create();
    $product = Product::factory()->for($vendeur, 'seller')->create([
        'name' => 'Test',
        'description' => 'Desc',
        'category' => 'cpu',
        'price' => 100,
        'stock_quantity' => 5,
    ]);

    $originalUpdatedAt = $product->updated_at;

    // Use travel to ensure time difference
    $this->travel(2)->seconds();

    $this->actingAs($vendeur, 'api')
        ->put("/api/seller/products/{$product->id}", [
            'name' => 'Updated',
            'description' => 'Desc',
            'category' => 'cpu',
            'price' => 100,
            'stock_quantity' => 5,
        ], ['Accept' => 'application/json'])
        ->assertStatus(200);

    $product->refresh();
    expect($product->updated_at->greaterThan($originalUpdatedAt))->toBeTrue();
});

// ---------------------------------------------------------------------------
// Validation errors
// ---------------------------------------------------------------------------

test('update without name returns 422', function () {
    Storage::fake('public');
    $vendeur = User::factory()->vendeur()->create();
    $product = Product::factory()->for($vendeur, 'seller')->create([
        'name' => 'Test',
        'description' => 'Desc',
        'category' => 'cpu',
        'price' => 100,
        'stock_quantity' => 5,
    ]);

    $response = $this->actingAs($vendeur, 'api')
        ->putJson("/api/seller/products/{$product->id}", [
            'description' => 'Desc',
            'category' => 'cpu',
            'price' => 100,
            'stock_quantity' => 5,
        ]);

    $response->assertStatus(422)
        ->assertJsonValidationErrors(['name']);
});

test('update without description returns 422', function () {
    Storage::fake('public');
    $vendeur = User::factory()->vendeur()->create();
    $product = Product::factory()->for($vendeur, 'seller')->create([
        'name' => 'Test',
        'description' => 'Desc',
        'category' => 'cpu',
        'price' => 100,
        'stock_quantity' => 5,
    ]);

    $response = $this->actingAs($vendeur, 'api')
        ->putJson("/api/seller/products/{$product->id}", [
            'name' => 'Test',
            'category' => 'cpu',
            'price' => 100,
            'stock_quantity' => 5,
        ]);

    $response->assertStatus(422)
        ->assertJsonValidationErrors(['description']);
});

test('update without category returns 422', function () {
    Storage::fake('public');
    $vendeur = User::factory()->vendeur()->create();
    $product = Product::factory()->for($vendeur, 'seller')->create([
        'name' => 'Test',
        'description' => 'Desc',
        'category' => 'cpu',
        'price' => 100,
        'stock_quantity' => 5,
    ]);

    $response = $this->actingAs($vendeur, 'api')
        ->putJson("/api/seller/products/{$product->id}", [
            'name' => 'Test',
            'description' => 'Desc',
            'price' => 100,
            'stock_quantity' => 5,
        ]);

    $response->assertStatus(422)
        ->assertJsonValidationErrors(['category']);
});

test('update with invalid category returns 422', function () {
    Storage::fake('public');
    $vendeur = User::factory()->vendeur()->create();
    $product = Product::factory()->for($vendeur, 'seller')->create([
        'name' => 'Test',
        'description' => 'Desc',
        'category' => 'cpu',
        'price' => 100,
        'stock_quantity' => 5,
    ]);

    $response = $this->actingAs($vendeur, 'api')
        ->putJson("/api/seller/products/{$product->id}", [
            'name' => 'Test',
            'description' => 'Desc',
            'category' => 'invalid_xyz',
            'price' => 100,
            'stock_quantity' => 5,
        ]);

    $response->assertStatus(422)
        ->assertJsonValidationErrors(['category']);
});

test('update with negative price returns 422', function () {
    Storage::fake('public');
    $vendeur = User::factory()->vendeur()->create();
    $product = Product::factory()->for($vendeur, 'seller')->create([
        'name' => 'Test',
        'description' => 'Desc',
        'category' => 'cpu',
        'price' => 100,
        'stock_quantity' => 5,
    ]);

    $response = $this->actingAs($vendeur, 'api')
        ->putJson("/api/seller/products/{$product->id}", [
            'name' => 'Test',
            'description' => 'Desc',
            'category' => 'cpu',
            'price' => -10,
            'stock_quantity' => 5,
        ]);

    $response->assertStatus(422)
        ->assertJsonValidationErrors(['price']);
});

test('update with price 0 returns 422', function () {
    Storage::fake('public');
    $vendeur = User::factory()->vendeur()->create();
    $product = Product::factory()->for($vendeur, 'seller')->create([
        'name' => 'Test',
        'description' => 'Desc',
        'category' => 'cpu',
        'price' => 100,
        'stock_quantity' => 5,
    ]);

    $response = $this->actingAs($vendeur, 'api')
        ->putJson("/api/seller/products/{$product->id}", [
            'name' => 'Test',
            'description' => 'Desc',
            'category' => 'cpu',
            'price' => 0,
            'stock_quantity' => 5,
        ]);

    $response->assertStatus(422)
        ->assertJsonValidationErrors(['price']);
});

test('update with negative stock returns 422', function () {
    Storage::fake('public');
    $vendeur = User::factory()->vendeur()->create();
    $product = Product::factory()->for($vendeur, 'seller')->create([
        'name' => 'Test',
        'description' => 'Desc',
        'category' => 'cpu',
        'price' => 100,
        'stock_quantity' => 5,
    ]);

    $response = $this->actingAs($vendeur, 'api')
        ->putJson("/api/seller/products/{$product->id}", [
            'name' => 'Test',
            'description' => 'Desc',
            'category' => 'cpu',
            'price' => 100,
            'stock_quantity' => -1,
        ]);

    $response->assertStatus(422)
        ->assertJsonValidationErrors(['stock_quantity']);
});

test('update with empty body returns 422 with all required field errors', function () {
    Storage::fake('public');
    $vendeur = User::factory()->vendeur()->create();
    $product = Product::factory()->for($vendeur, 'seller')->create([
        'name' => 'Test',
        'description' => 'Desc',
        'category' => 'cpu',
        'price' => 100,
        'stock_quantity' => 5,
    ]);

    $response = $this->actingAs($vendeur, 'api')
        ->putJson("/api/seller/products/{$product->id}", []);

    $response->assertStatus(422)
        ->assertJsonValidationErrors(['name', 'description', 'category', 'price', 'stock_quantity']);
});

test('update does not require photo (photo is optional on update)', function () {
    Storage::fake('public');
    $vendeur = User::factory()->vendeur()->create();
    $product = Product::factory()->for($vendeur, 'seller')->create([
        'name' => 'Test',
        'description' => 'Desc',
        'category' => 'cpu',
        'price' => 100,
        'stock_quantity' => 5,
    ]);

    $response = $this->actingAs($vendeur, 'api')
        ->put("/api/seller/products/{$product->id}", [
            'name' => 'Updated Without Photo',
            'description' => 'Desc',
            'category' => 'cpu',
            'price' => 100,
            'stock_quantity' => 5,
        ], ['Accept' => 'application/json']);

    // Should succeed — no photo validation error
    $response->assertStatus(200);
    $response->assertJsonMissing(['errors' => ['photo']]);
});

test('validation errors prevent product update in DB', function () {
    Storage::fake('public');
    $vendeur = User::factory()->vendeur()->create();
    $product = Product::factory()->for($vendeur, 'seller')->create([
        'name' => 'Original Name',
        'description' => 'Desc',
        'category' => 'cpu',
        'price' => 100,
        'stock_quantity' => 5,
    ]);

    $this->actingAs($vendeur, 'api')
        ->putJson("/api/seller/products/{$product->id}", [
            'name' => '', // Invalid
            'description' => 'Desc',
            'category' => 'cpu',
            'price' => 100,
            'stock_quantity' => 5,
        ])
        ->assertStatus(422);

    // Product should NOT have been modified
    $product->refresh();
    expect($product->name)->toBe('Original Name');
});

test('validation error messages are in French', function () {
    Storage::fake('public');
    $vendeur = User::factory()->vendeur()->create();
    $product = Product::factory()->for($vendeur, 'seller')->create([
        'name' => 'Test',
        'description' => 'Desc',
        'category' => 'cpu',
        'price' => 100,
        'stock_quantity' => 5,
    ]);

    $response = $this->actingAs($vendeur, 'api')
        ->putJson("/api/seller/products/{$product->id}", [
            'description' => 'Desc',
            'category' => 'cpu',
            'price' => -5,
            'stock_quantity' => 5,
        ]);

    $response->assertStatus(422);

    $errors = $response->json('errors');
    // Name error should be in French
    expect($errors['name'][0])->toContain('nom');
    // Price error should be in French
    expect($errors['price'][0])->toContain('supérieur à 0');
});

// ---------------------------------------------------------------------------
// Ownership check (AC3 / NFR11)
// ---------------------------------------------------------------------------

test('vendeur cannot update another vendeur\'s product (403)', function () {
    Storage::fake('public');
    $vendeur1 = User::factory()->vendeur()->create();
    $vendeur2 = User::factory()->vendeur()->create();

    $product = Product::factory()->for($vendeur1, 'seller')->create([
        'name' => 'Original Name',
        'description' => 'Desc',
        'category' => 'cpu',
        'price' => 100,
        'stock_quantity' => 5,
    ]);

    $response = $this->actingAs($vendeur2, 'api')
        ->put("/api/seller/products/{$product->id}", [
            'name' => 'Hijacked Name',
            'description' => 'Hijacked',
            'category' => 'gpu',
            'price' => 1,
            'stock_quantity' => 1,
        ], ['Accept' => 'application/json']);

    $response->assertStatus(403);

    // Product should NOT have been modified
    $product->refresh();
    expect($product->name)->toBe('Original Name');
});

test('vendeur2 update attempt does not modify product in DB', function () {
    Storage::fake('public');
    $vendeur1 = User::factory()->vendeur()->create();
    $vendeur2 = User::factory()->vendeur()->create();

    $product = Product::factory()->for($vendeur1, 'seller')->create([
        'name' => 'Untouched',
        'description' => 'Untouched desc',
        'category' => 'cpu',
        'price' => 200,
        'stock_quantity' => 10,
    ]);

    $this->actingAs($vendeur2, 'api')
        ->put("/api/seller/products/{$product->id}", [
            'name' => 'Attacked',
            'description' => 'Attacked',
            'category' => 'gpu',
            'price' => 1,
            'stock_quantity' => 0,
        ], ['Accept' => 'application/json'])
        ->assertStatus(403);

    $this->assertDatabaseHas('products', [
        'id' => $product->id,
        'name' => 'Untouched',
        'description' => 'Untouched desc',
        'category' => 'cpu',
        'price' => '200.00',
        'stock_quantity' => 10,
    ]);
});

test('update returns 403 for non-existent product', function () {
    $vendeur = User::factory()->vendeur()->create();

    $response = $this->actingAs($vendeur, 'api')
        ->put('/api/seller/products/999999', [
            'name' => 'Test',
            'description' => 'Desc',
            'category' => 'cpu',
            'price' => 100,
            'stock_quantity' => 5,
        ], ['Accept' => 'application/json']);

    $response->assertStatus(403);
});

// ---------------------------------------------------------------------------
// Authentication & Authorization
// ---------------------------------------------------------------------------

test('unauthenticated user cannot update product (401)', function () {
    $response = $this->putJson('/api/seller/products/1', [
        'name' => 'Test',
        'description' => 'Desc',
        'category' => 'cpu',
        'price' => 100,
        'stock_quantity' => 5,
    ]);

    $response->assertStatus(401);
});

test('acheteur cannot update product (403)', function () {
    Storage::fake('public');
    $acheteur = User::factory()->acheteur()->create();
    $vendeur = User::factory()->vendeur()->create();

    $product = Product::factory()->for($vendeur, 'seller')->create([
        'name' => 'Test',
        'description' => 'Desc',
        'category' => 'cpu',
        'price' => 100,
        'stock_quantity' => 5,
    ]);

    $response = $this->actingAs($acheteur, 'api')
        ->put("/api/seller/products/{$product->id}", [
            'name' => 'Acheteur Attack',
            'description' => 'Should fail',
            'category' => 'cpu',
            'price' => 1,
            'stock_quantity' => 1,
        ], ['Accept' => 'application/json']);

    $response->assertStatus(403);
});

test('admin can update their own product', function () {
    Storage::fake('public');
    $admin = User::factory()->admin()->create();
    $product = Product::factory()->for($admin, 'seller')->create([
        'name' => 'Admin Product',
        'description' => 'Desc',
        'category' => 'cpu',
        'price' => 100,
        'stock_quantity' => 5,
    ]);

    $response = $this->actingAs($admin, 'api')
        ->put("/api/seller/products/{$product->id}", [
            'name' => 'Admin Updated',
            'description' => 'Updated by admin',
            'category' => 'gpu',
            'price' => 200,
            'stock_quantity' => 10,
        ], ['Accept' => 'application/json']);

    $response->assertStatus(200)
        ->assertJsonPath('data.name', 'Admin Updated');
});

// ---------------------------------------------------------------------------
// All 8 categories accepted on update
// ---------------------------------------------------------------------------

test('all 8 categories are accepted on update', function () {
    Storage::fake('public');
    $vendeur = User::factory()->vendeur()->create();

    foreach (ProductCategory::values() as $category) {
        $product = Product::factory()->for($vendeur, 'seller')->create([
            'name' => "Product {$category}",
            'description' => 'Test',
            'category' => 'cpu',
            'price' => 100,
            'stock_quantity' => 5,
        ]);

        $response = $this->actingAs($vendeur, 'api')
            ->put("/api/seller/products/{$product->id}", [
                'name' => "Updated {$category}",
                'description' => 'Test',
                'category' => $category,
                'price' => 100,
                'stock_quantity' => 5,
            ], ['Accept' => 'application/json']);

        $response->assertStatus(200);
        expect($response->json('data.category'))->toBe($category);
    }
});
