<?php

use App\Models\Product;
use App\Models\User;

// ===========================================================================
// GET /api/products — Public product catalogue
// Story 2.4: Only active products visible in public catalogue
// ===========================================================================

// ---------------------------------------------------------------------------
// Happy path — Public catalogue returns active products
// ---------------------------------------------------------------------------

test('public catalogue returns only active products', function () {
    $vendeur = User::factory()->vendeur()->create();

    $activeProduct = Product::factory()->for($vendeur, 'seller')->create([
        'is_active' => true,
        'name' => 'Active Product',
    ]);

    $inactiveProduct = Product::factory()->for($vendeur, 'seller')->inactive()->create([
        'name' => 'Inactive Product',
    ]);

    $response = $this->getJson('/api/products');

    $response->assertStatus(200);

    $productIds = collect($response->json('data'))->pluck('id')->toArray();

    expect($productIds)->toContain($activeProduct->id);
    expect($productIds)->not->toContain($inactiveProduct->id);
});

test('public catalogue returns 200 with empty array when no active products', function () {
    // No products at all
    $response = $this->getJson('/api/products');

    $response->assertStatus(200)
        ->assertJsonStructure(['data'])
        ->assertJsonCount(0, 'data');
});

test('public catalogue does not require authentication', function () {
    $response = $this->getJson('/api/products');

    $response->assertStatus(200);
});

test('public catalogue returns ProductResource structure', function () {
    $vendeur = User::factory()->vendeur()->create();
    Product::factory()->for($vendeur, 'seller')->create(['is_active' => true]);

    $response = $this->getJson('/api/products');

    $response->assertStatus(200)
        ->assertJsonStructure([
            'data' => [
                '*' => ['id', 'name', 'description', 'category', 'price', 'stock_quantity', 'is_active', 'photo_url', 'specs'],
            ],
        ]);
});

// ---------------------------------------------------------------------------
// Integration with toggle — deactivated product disappears from catalogue
// ---------------------------------------------------------------------------

test('deactivated product disappears from public catalogue', function () {
    $vendeur = User::factory()->vendeur()->create();
    $product = Product::factory()->for($vendeur, 'seller')->create([
        'is_active' => true,
    ]);

    // Product should appear in catalogue
    $response = $this->getJson('/api/products');
    $productIds = collect($response->json('data'))->pluck('id')->toArray();
    expect($productIds)->toContain($product->id);

    // Toggle status to inactive
    $this->actingAs($vendeur, 'api')
        ->patchJson("/api/seller/products/{$product->id}/toggle-status")
        ->assertStatus(200);

    // Product should no longer appear in catalogue
    $response = $this->getJson('/api/products');
    $productIds = collect($response->json('data'))->pluck('id')->toArray();
    expect($productIds)->not->toContain($product->id);
});

test('reactivated product reappears in public catalogue', function () {
    $vendeur = User::factory()->vendeur()->create();
    $product = Product::factory()->for($vendeur, 'seller')->inactive()->create();

    // Product should NOT appear in catalogue
    $response = $this->getJson('/api/products');
    $productIds = collect($response->json('data'))->pluck('id')->toArray();
    expect($productIds)->not->toContain($product->id);

    // Toggle status to active
    $this->actingAs($vendeur, 'api')
        ->patchJson("/api/seller/products/{$product->id}/toggle-status")
        ->assertStatus(200);

    // Product should now appear in catalogue
    $response = $this->getJson('/api/products');
    $productIds = collect($response->json('data'))->pluck('id')->toArray();
    expect($productIds)->toContain($product->id);
});
