<?php

use App\Models\Product;
use App\Models\User;
use Illuminate\Support\Facades\Storage;

// ===========================================================================
// DELETE /api/seller/products/{id} — Delete a seller's product
// Story 2.5: Delete Product
// ===========================================================================

// ---------------------------------------------------------------------------
// Happy path — successful deletion
// ---------------------------------------------------------------------------

test('vendeur can delete their own product (204 No Content)', function () {
    $vendeur = User::factory()->vendeur()->create();
    $product = Product::factory()->for($vendeur, 'seller')->create();

    $response = $this->actingAs($vendeur, 'api')
        ->deleteJson("/api/seller/products/{$product->id}");

    $response->assertStatus(204);
});

test('deleted product no longer exists in database (hard delete)', function () {
    $vendeur = User::factory()->vendeur()->create();
    $product = Product::factory()->for($vendeur, 'seller')->create();

    $this->actingAs($vendeur, 'api')
        ->deleteJson("/api/seller/products/{$product->id}")
        ->assertStatus(204);

    $this->assertDatabaseMissing('products', ['id' => $product->id]);
});

test('delete removes associated photo from storage', function () {
    Storage::fake('public');

    $vendeur = User::factory()->vendeur()->create();

    // Create a fake file in storage
    Storage::disk('public')->put('products/test-photo.jpg', 'fake-image-content');

    $product = Product::factory()->for($vendeur, 'seller')->create([
        'photo_path' => 'products/test-photo.jpg',
    ]);

    // Verify file exists before deletion
    Storage::disk('public')->assertExists('products/test-photo.jpg');

    $this->actingAs($vendeur, 'api')
        ->deleteJson("/api/seller/products/{$product->id}")
        ->assertStatus(204);

    // Verify file was deleted from storage
    Storage::disk('public')->assertMissing('products/test-photo.jpg');
});

test('delete product without photo_path does not cause errors', function () {
    $vendeur = User::factory()->vendeur()->create();
    $product = Product::factory()->for($vendeur, 'seller')->withoutPhoto()->create([
        'photo_path' => null,
    ]);

    $response = $this->actingAs($vendeur, 'api')
        ->deleteJson("/api/seller/products/{$product->id}");

    $response->assertStatus(204);
    $this->assertDatabaseMissing('products', ['id' => $product->id]);
});

// ---------------------------------------------------------------------------
// Data integrity — delete does not affect other products
// ---------------------------------------------------------------------------

test('deleting one product does not affect other products of the same seller', function () {
    $vendeur = User::factory()->vendeur()->create();
    $productToDelete = Product::factory()->for($vendeur, 'seller')->create(['name' => 'To Delete']);
    $productToKeep = Product::factory()->for($vendeur, 'seller')->create(['name' => 'To Keep']);

    $this->actingAs($vendeur, 'api')
        ->deleteJson("/api/seller/products/{$productToDelete->id}")
        ->assertStatus(204);

    // Deleted product is gone
    $this->assertDatabaseMissing('products', ['id' => $productToDelete->id]);

    // Other product still exists and is unchanged
    $this->assertDatabaseHas('products', [
        'id' => $productToKeep->id,
        'name' => 'To Keep',
        'seller_id' => $vendeur->id,
    ]);
});

test('delete count decreases by exactly 1', function () {
    $vendeur = User::factory()->vendeur()->create();
    Product::factory()->for($vendeur, 'seller')->count(3)->create();

    $products = Product::where('seller_id', $vendeur->id)->get();
    expect($products->count())->toBe(3);

    $productToDelete = $products->first();

    $this->actingAs($vendeur, 'api')
        ->deleteJson("/api/seller/products/{$productToDelete->id}")
        ->assertStatus(204);

    $countAfter = Product::where('seller_id', $vendeur->id)->count();
    expect($countAfter)->toBe(2);
});

test('delete does not cascade-delete the seller user', function () {
    $vendeur = User::factory()->vendeur()->create();
    $product = Product::factory()->for($vendeur, 'seller')->create();

    $this->actingAs($vendeur, 'api')
        ->deleteJson("/api/seller/products/{$product->id}")
        ->assertStatus(204);

    // Seller user should still exist
    $this->assertDatabaseHas('users', [
        'id' => $vendeur->id,
        'role' => 'vendeur',
    ]);
});

// ---------------------------------------------------------------------------
// Deleted product disappears from listing endpoints
// ---------------------------------------------------------------------------

test('deleted product no longer appears in seller product list', function () {
    $vendeur = User::factory()->vendeur()->create();
    $product = Product::factory()->for($vendeur, 'seller')->create(['name' => 'Deleted Product']);

    // Verify it appears in seller list before
    $beforeResponse = $this->actingAs($vendeur, 'api')
        ->getJson('/api/seller/products');
    $beforeResponse->assertStatus(200);
    $beforeIds = collect($beforeResponse->json('data'))->pluck('id')->toArray();
    expect($beforeIds)->toContain($product->id);

    // Delete
    $this->actingAs($vendeur, 'api')
        ->deleteJson("/api/seller/products/{$product->id}")
        ->assertStatus(204);

    // Verify it no longer appears in seller list
    $afterResponse = $this->actingAs($vendeur, 'api')
        ->getJson('/api/seller/products');
    $afterResponse->assertStatus(200);
    $afterIds = collect($afterResponse->json('data'))->pluck('id')->toArray();
    expect($afterIds)->not->toContain($product->id);
});

test('deleted product no longer appears in public catalogue', function () {
    $vendeur = User::factory()->vendeur()->create();
    $product = Product::factory()->for($vendeur, 'seller')->active()->create(['name' => 'Visible Product']);

    // Verify it appears in public catalogue before
    $beforeResponse = $this->getJson('/api/products');
    $beforeResponse->assertStatus(200);
    $beforeIds = collect($beforeResponse->json('data'))->pluck('id')->toArray();
    expect($beforeIds)->toContain($product->id);

    // Delete
    $this->actingAs($vendeur, 'api')
        ->deleteJson("/api/seller/products/{$product->id}")
        ->assertStatus(204);

    // Verify it no longer appears in public catalogue
    $afterResponse = $this->getJson('/api/products');
    $afterResponse->assertStatus(200);
    $afterIds = collect($afterResponse->json('data'))->pluck('id')->toArray();
    expect($afterIds)->not->toContain($product->id);
});

// ---------------------------------------------------------------------------
// Double deletion — idempotence
// ---------------------------------------------------------------------------

test('deleting a product twice returns 403 on the second attempt', function () {
    $vendeur = User::factory()->vendeur()->create();
    $product = Product::factory()->for($vendeur, 'seller')->create();

    // First delete succeeds
    $this->actingAs($vendeur, 'api')
        ->deleteJson("/api/seller/products/{$product->id}")
        ->assertStatus(204);

    // Second delete returns 403 (product no longer found for this seller)
    $this->actingAs($vendeur, 'api')
        ->deleteJson("/api/seller/products/{$product->id}")
        ->assertStatus(403);
});

// ---------------------------------------------------------------------------
// Ownership — vendeur can only delete their own products
// ---------------------------------------------------------------------------

test('vendeur cannot delete another vendeur\'s product (403)', function () {
    $vendeur1 = User::factory()->vendeur()->create();
    $vendeur2 = User::factory()->vendeur()->create();

    $product = Product::factory()->for($vendeur1, 'seller')->create();

    $response = $this->actingAs($vendeur2, 'api')
        ->deleteJson("/api/seller/products/{$product->id}");

    $response->assertStatus(403);

    // Product should NOT have been deleted
    $this->assertDatabaseHas('products', ['id' => $product->id]);
});

test('vendeur1 product remains intact after vendeur2 failed delete attempt', function () {
    $vendeur1 = User::factory()->vendeur()->create();
    $vendeur2 = User::factory()->vendeur()->create();

    $product = Product::factory()->for($vendeur1, 'seller')->create([
        'name' => 'Protected Product',
        'price' => 99.99,
        'stock_quantity' => 42,
        'is_active' => true,
    ]);

    $this->actingAs($vendeur2, 'api')
        ->deleteJson("/api/seller/products/{$product->id}")
        ->assertStatus(403);

    // Product should remain unchanged
    $product->refresh();
    expect($product->name)->toBe('Protected Product');
    expect((float) $product->price)->toBe(99.99);
    expect($product->stock_quantity)->toBe(42);
    expect($product->is_active)->toBeTrue();
});

// ---------------------------------------------------------------------------
// Non-existent product
// ---------------------------------------------------------------------------

test('delete returns 403 for non-existent product', function () {
    $vendeur = User::factory()->vendeur()->create();

    $response = $this->actingAs($vendeur, 'api')
        ->deleteJson('/api/seller/products/999999');

    $response->assertStatus(403);
});

// ---------------------------------------------------------------------------
// Authentication & Authorization
// ---------------------------------------------------------------------------

test('unauthenticated user cannot delete product (401)', function () {
    $vendeur = User::factory()->vendeur()->create();
    $product = Product::factory()->for($vendeur, 'seller')->create();

    $response = $this->deleteJson("/api/seller/products/{$product->id}");

    $response->assertStatus(401);

    // Product should NOT have been deleted
    $this->assertDatabaseHas('products', ['id' => $product->id]);
});

test('acheteur cannot delete product (403)', function () {
    $acheteur = User::factory()->acheteur()->create();
    $vendeur = User::factory()->vendeur()->create();

    $product = Product::factory()->for($vendeur, 'seller')->create();

    $response = $this->actingAs($acheteur, 'api')
        ->deleteJson("/api/seller/products/{$product->id}");

    $response->assertStatus(403);

    // Product should NOT have been deleted
    $this->assertDatabaseHas('products', ['id' => $product->id]);
});

test('admin cannot delete product via seller API (403)', function () {
    $admin = User::factory()->admin()->create();
    $vendeur = User::factory()->vendeur()->create();

    $product = Product::factory()->for($vendeur, 'seller')->create();

    $response = $this->actingAs($admin, 'api')
        ->deleteJson("/api/seller/products/{$product->id}");

    $response->assertStatus(403);

    // Product should NOT have been deleted
    $this->assertDatabaseHas('products', ['id' => $product->id]);
});
