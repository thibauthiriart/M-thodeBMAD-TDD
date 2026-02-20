<?php

use App\Models\Product;
use App\Models\User;

// ===========================================================================
// PATCH /api/seller/products/{id}/toggle-status — Toggle product active status
// Story 2.4: Activate/Deactivate Product
// ===========================================================================

// ---------------------------------------------------------------------------
// Happy path — Toggle active → inactive
// ---------------------------------------------------------------------------

test('vendeur can toggle active product to inactive', function () {
    $vendeur = User::factory()->vendeur()->create();
    $product = Product::factory()->for($vendeur, 'seller')->create([
        'is_active' => true,
    ]);

    $response = $this->actingAs($vendeur, 'api')
        ->patchJson("/api/seller/products/{$product->id}/toggle-status");

    $response->assertStatus(200)
        ->assertJsonPath('data.id', $product->id)
        ->assertJsonPath('data.is_active', false);

    $product->refresh();
    expect($product->is_active)->toBeFalse();
});

// ---------------------------------------------------------------------------
// Happy path — Toggle inactive → active
// ---------------------------------------------------------------------------

test('vendeur can toggle inactive product to active', function () {
    $vendeur = User::factory()->vendeur()->create();
    $product = Product::factory()->for($vendeur, 'seller')->inactive()->create();

    $response = $this->actingAs($vendeur, 'api')
        ->patchJson("/api/seller/products/{$product->id}/toggle-status");

    $response->assertStatus(200)
        ->assertJsonPath('data.id', $product->id)
        ->assertJsonPath('data.is_active', true);

    $product->refresh();
    expect($product->is_active)->toBeTrue();
});

// ---------------------------------------------------------------------------
// ProductResource structure
// ---------------------------------------------------------------------------

test('toggle returns ProductResource with all required fields', function () {
    $vendeur = User::factory()->vendeur()->create();
    $product = Product::factory()->for($vendeur, 'seller')->create([
        'is_active' => true,
    ]);

    $response = $this->actingAs($vendeur, 'api')
        ->patchJson("/api/seller/products/{$product->id}/toggle-status");

    $response->assertStatus(200)
        ->assertJsonStructure([
            'data' => ['id', 'name', 'description', 'category', 'price', 'stock_quantity', 'is_active', 'photo_url', 'specs'],
        ]);
});

// ---------------------------------------------------------------------------
// Double toggle — idempotence
// ---------------------------------------------------------------------------

test('double toggle returns product to original state', function () {
    $vendeur = User::factory()->vendeur()->create();
    $product = Product::factory()->for($vendeur, 'seller')->create([
        'is_active' => true,
    ]);

    // First toggle: active → inactive
    $this->actingAs($vendeur, 'api')
        ->patchJson("/api/seller/products/{$product->id}/toggle-status")
        ->assertStatus(200)
        ->assertJsonPath('data.is_active', false);

    // Second toggle: inactive → active
    $this->actingAs($vendeur, 'api')
        ->patchJson("/api/seller/products/{$product->id}/toggle-status")
        ->assertStatus(200)
        ->assertJsonPath('data.is_active', true);

    $product->refresh();
    expect($product->is_active)->toBeTrue();
});

// ---------------------------------------------------------------------------
// Data integrity — toggle only changes is_active
// ---------------------------------------------------------------------------

test('toggle preserves all other product fields', function () {
    $vendeur = User::factory()->vendeur()->create();
    $product = Product::factory()->for($vendeur, 'seller')->create([
        'name' => 'Test Product',
        'description' => 'Test Description',
        'category' => 'cpu',
        'price' => 88.88,
        'stock_quantity' => 42,
        'is_active' => true,
    ]);

    $this->actingAs($vendeur, 'api')
        ->patchJson("/api/seller/products/{$product->id}/toggle-status")
        ->assertStatus(200);

    $product->refresh();
    expect($product->is_active)->toBeFalse();
    expect($product->name)->toBe('Test Product');
    expect($product->description)->toBe('Test Description');
    expect((float) $product->price)->toBe(88.88);
    expect($product->stock_quantity)->toBe(42);
    expect($product->seller_id)->toBe($vendeur->id);
});

test('toggle updates updated_at timestamp', function () {
    $vendeur = User::factory()->vendeur()->create();
    $product = Product::factory()->for($vendeur, 'seller')->create([
        'is_active' => true,
    ]);

    $originalUpdatedAt = $product->updated_at;

    // Use travel to ensure time difference
    $this->travel(2)->seconds();

    $this->actingAs($vendeur, 'api')
        ->patchJson("/api/seller/products/{$product->id}/toggle-status")
        ->assertStatus(200);

    $product->refresh();
    expect($product->updated_at->greaterThan($originalUpdatedAt))->toBeTrue();
});

// ---------------------------------------------------------------------------
// Ownership — vendeur can only toggle their own products
// ---------------------------------------------------------------------------

test('vendeur cannot toggle another vendeur\'s product (403)', function () {
    $vendeur1 = User::factory()->vendeur()->create();
    $vendeur2 = User::factory()->vendeur()->create();

    $product = Product::factory()->for($vendeur1, 'seller')->create([
        'is_active' => true,
    ]);

    $response = $this->actingAs($vendeur2, 'api')
        ->patchJson("/api/seller/products/{$product->id}/toggle-status");

    $response->assertStatus(403);

    // Product should NOT have been modified
    $product->refresh();
    expect($product->is_active)->toBeTrue();
});

test('toggle returns 403 for non-existent product', function () {
    $vendeur = User::factory()->vendeur()->create();

    $response = $this->actingAs($vendeur, 'api')
        ->patchJson('/api/seller/products/999999/toggle-status');

    $response->assertStatus(403);
});

// ---------------------------------------------------------------------------
// Authentication & Authorization
// ---------------------------------------------------------------------------

test('unauthenticated user cannot toggle product (401)', function () {
    $vendeur = User::factory()->vendeur()->create();
    $product = Product::factory()->for($vendeur, 'seller')->create();

    $response = $this->patchJson("/api/seller/products/{$product->id}/toggle-status");

    $response->assertStatus(401);
});

test('acheteur cannot toggle product (403)', function () {
    $acheteur = User::factory()->acheteur()->create();
    $vendeur = User::factory()->vendeur()->create();

    $product = Product::factory()->for($vendeur, 'seller')->create([
        'is_active' => true,
    ]);

    $response = $this->actingAs($acheteur, 'api')
        ->patchJson("/api/seller/products/{$product->id}/toggle-status");

    $response->assertStatus(403);

    // Product should NOT have been modified
    $product->refresh();
    expect($product->is_active)->toBeTrue();
});

test('admin cannot toggle product (403)', function () {
    $admin = User::factory()->admin()->create();
    $vendeur = User::factory()->vendeur()->create();

    $product = Product::factory()->for($vendeur, 'seller')->create([
        'is_active' => true,
    ]);

    $response = $this->actingAs($admin, 'api')
        ->patchJson("/api/seller/products/{$product->id}/toggle-status");

    $response->assertStatus(403);

    // Product should NOT have been modified
    $product->refresh();
    expect($product->is_active)->toBeTrue();
});
