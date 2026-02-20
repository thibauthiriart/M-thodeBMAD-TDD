<?php

use App\Models\Cart;
use App\Models\CartItem;
use App\Models\Product;
use App\Models\User;

// =============================================================================
// Helper: create a buyer user with a Passport token
// =============================================================================
function createBuyer(array $overrides = []): User
{
    return User::factory()->create(array_merge([
        'role' => 'acheteur',
    ], $overrides));
}

function createSeller(array $overrides = []): User
{
    return User::factory()->create(array_merge([
        'role' => 'vendeur',
    ], $overrides));
}

function createProduct(User $seller, array $overrides = []): Product
{
    return Product::factory()->create(array_merge([
        'seller_id' => $seller->id,
        'is_active' => true,
        'stock_quantity' => 10,
    ], $overrides));
}

// =============================================================================
// POST /api/cart/items — AC1: Add product to cart
// =============================================================================

test('authenticated buyer can add a product to cart', function () {
    $seller = createSeller();
    $buyer = createBuyer();
    $product = createProduct($seller);

    $response = $this->actingAs($buyer, 'api')
        ->postJson('/api/cart/items', [
            'product_id' => $product->id,
        ]);

    $response->assertStatus(200)
        ->assertJsonStructure([
            'data' => [
                'id',
                'user_id',
                'items',
                'total_items',
            ],
        ]);

    // Verify the cart was created in DB
    $this->assertDatabaseHas('carts', [
        'user_id' => $buyer->id,
    ]);

    $this->assertDatabaseHas('cart_items', [
        'product_id' => $product->id,
        'quantity' => 1,
    ]);
});

test('add to cart returns cart with items array containing the product', function () {
    $seller = createSeller();
    $buyer = createBuyer();
    $product = createProduct($seller, ['price' => 299.99]);

    $response = $this->actingAs($buyer, 'api')
        ->postJson('/api/cart/items', [
            'product_id' => $product->id,
        ]);

    $response->assertStatus(200);

    $data = $response->json('data');
    expect($data['items'])->toBeArray();
    expect($data['items'])->toHaveCount(1);
    expect($data['items'][0]['product_id'])->toBe($product->id);
    expect($data['items'][0]['quantity'])->toBe(1);
    expect($data['total_items'])->toBe(1);
});

test('add to cart with explicit quantity 1', function () {
    $seller = createSeller();
    $buyer = createBuyer();
    $product = createProduct($seller);

    $response = $this->actingAs($buyer, 'api')
        ->postJson('/api/cart/items', [
            'product_id' => $product->id,
            'quantity' => 1,
        ]);

    $response->assertStatus(200);

    $this->assertDatabaseHas('cart_items', [
        'product_id' => $product->id,
        'quantity' => 1,
    ]);
});

// =============================================================================
// POST /api/cart/items — AC2: Product already in cart → increment quantity
// =============================================================================

test('adding same product twice increments quantity to 2', function () {
    $seller = createSeller();
    $buyer = createBuyer();
    $product = createProduct($seller);

    // First add
    $this->actingAs($buyer, 'api')
        ->postJson('/api/cart/items', ['product_id' => $product->id])
        ->assertStatus(200);

    // Second add
    $response = $this->actingAs($buyer, 'api')
        ->postJson('/api/cart/items', ['product_id' => $product->id]);

    $response->assertStatus(200);

    // Verify quantity is 2, not two separate entries
    $cart = Cart::where('user_id', $buyer->id)->first();
    $cartItems = CartItem::where('cart_id', $cart->id)
        ->where('product_id', $product->id)
        ->get();

    expect($cartItems)->toHaveCount(1);
    expect($cartItems->first()->quantity)->toBe(2);
});

test('adding same product 3 times results in quantity 3', function () {
    $seller = createSeller();
    $buyer = createBuyer();
    $product = createProduct($seller);

    for ($i = 0; $i < 3; $i++) {
        $this->actingAs($buyer, 'api')
            ->postJson('/api/cart/items', ['product_id' => $product->id])
            ->assertStatus(200);
    }

    $cart = Cart::where('user_id', $buyer->id)->first();
    $cartItem = CartItem::where('cart_id', $cart->id)
        ->where('product_id', $product->id)
        ->first();

    expect($cartItem->quantity)->toBe(3);
});

test('adding two different products creates two distinct cart items', function () {
    $seller = createSeller();
    $buyer = createBuyer();
    $product1 = createProduct($seller);
    $product2 = createProduct($seller);

    $this->actingAs($buyer, 'api')
        ->postJson('/api/cart/items', ['product_id' => $product1->id])
        ->assertStatus(200);

    $this->actingAs($buyer, 'api')
        ->postJson('/api/cart/items', ['product_id' => $product2->id])
        ->assertStatus(200);

    $cart = Cart::where('user_id', $buyer->id)->first();
    $cartItems = CartItem::where('cart_id', $cart->id)->get();

    expect($cartItems)->toHaveCount(2);

    $item1 = $cartItems->firstWhere('product_id', $product1->id);
    $item2 = $cartItems->firstWhere('product_id', $product2->id);

    expect($item1->quantity)->toBe(1);
    expect($item2->quantity)->toBe(1);
});

test('adding same product after another product increments the correct item', function () {
    $seller = createSeller();
    $buyer = createBuyer();
    $product1 = createProduct($seller);
    $product2 = createProduct($seller);

    // Add product 1
    $this->actingAs($buyer, 'api')
        ->postJson('/api/cart/items', ['product_id' => $product1->id]);

    // Add product 2
    $this->actingAs($buyer, 'api')
        ->postJson('/api/cart/items', ['product_id' => $product2->id]);

    // Add product 1 again
    $this->actingAs($buyer, 'api')
        ->postJson('/api/cart/items', ['product_id' => $product1->id]);

    $cart = Cart::where('user_id', $buyer->id)->first();

    $item1 = CartItem::where('cart_id', $cart->id)
        ->where('product_id', $product1->id)
        ->first();
    $item2 = CartItem::where('cart_id', $cart->id)
        ->where('product_id', $product2->id)
        ->first();

    expect($item1->quantity)->toBe(2);
    expect($item2->quantity)->toBe(1);
});

test('response total_items reflects sum of quantities', function () {
    $seller = createSeller();
    $buyer = createBuyer();
    $product1 = createProduct($seller);
    $product2 = createProduct($seller);

    // Add product1 twice
    $this->actingAs($buyer, 'api')
        ->postJson('/api/cart/items', ['product_id' => $product1->id]);
    $this->actingAs($buyer, 'api')
        ->postJson('/api/cart/items', ['product_id' => $product1->id]);

    // Add product2 once
    $response = $this->actingAs($buyer, 'api')
        ->postJson('/api/cart/items', ['product_id' => $product2->id]);

    $response->assertStatus(200);
    expect($response->json('data.total_items'))->toBe(3);
});

// =============================================================================
// POST /api/cart/items — AC3: Unauthenticated → 401
// =============================================================================

test('unauthenticated request returns 401', function () {
    $seller = createSeller();
    $product = createProduct($seller);

    $response = $this->postJson('/api/cart/items', [
        'product_id' => $product->id,
        'quantity' => 1,
    ]);

    $response->assertStatus(401);
});

// =============================================================================
// Validation errors
// =============================================================================

test('missing product_id returns 422', function () {
    $buyer = createBuyer();

    $response = $this->actingAs($buyer, 'api')
        ->postJson('/api/cart/items', []);

    $response->assertStatus(422)
        ->assertJsonValidationErrors(['product_id']);
});

test('non-existent product_id returns 422', function () {
    $buyer = createBuyer();

    $response = $this->actingAs($buyer, 'api')
        ->postJson('/api/cart/items', [
            'product_id' => 999999,
        ]);

    $response->assertStatus(422);
});

test('adding out-of-stock product returns 422', function () {
    $seller = createSeller();
    $buyer = createBuyer();
    $product = createProduct($seller, ['stock_quantity' => 0]);

    $response = $this->actingAs($buyer, 'api')
        ->postJson('/api/cart/items', [
            'product_id' => $product->id,
        ]);

    $response->assertStatus(422);
});

test('adding inactive product returns 422', function () {
    $seller = createSeller();
    $buyer = createBuyer();
    $product = createProduct($seller, ['is_active' => false]);

    $response = $this->actingAs($buyer, 'api')
        ->postJson('/api/cart/items', [
            'product_id' => $product->id,
        ]);

    $response->assertStatus(422);
});

test('quantity must be at least 1', function () {
    $seller = createSeller();
    $buyer = createBuyer();
    $product = createProduct($seller);

    $response = $this->actingAs($buyer, 'api')
        ->postJson('/api/cart/items', [
            'product_id' => $product->id,
            'quantity' => 0,
        ]);

    $response->assertStatus(422)
        ->assertJsonValidationErrors(['quantity']);
});

// =============================================================================
// NFR18: Cart persistence in DB
// =============================================================================

test('cart is persisted in database not in session (NFR18)', function () {
    $seller = createSeller();
    $buyer = createBuyer();
    $product = createProduct($seller);

    $this->actingAs($buyer, 'api')
        ->postJson('/api/cart/items', ['product_id' => $product->id])
        ->assertStatus(200);

    // Verify in DB directly
    $cart = Cart::where('user_id', $buyer->id)->first();
    expect($cart)->not->toBeNull();
    expect($cart->user_id)->toBe($buyer->id);

    $cartItem = CartItem::where('cart_id', $cart->id)->first();
    expect($cartItem)->not->toBeNull();
    expect($cartItem->product_id)->toBe($product->id);
    expect($cartItem->quantity)->toBe(1);
});

test('each buyer has their own isolated cart', function () {
    $seller = createSeller();
    $buyer1 = createBuyer();
    $buyer2 = createBuyer();
    $product = createProduct($seller);

    // Buyer 1 adds product
    $this->actingAs($buyer1, 'api')
        ->postJson('/api/cart/items', ['product_id' => $product->id])
        ->assertStatus(200);

    // Buyer 2 adds same product
    $this->actingAs($buyer2, 'api')
        ->postJson('/api/cart/items', ['product_id' => $product->id])
        ->assertStatus(200);

    // Each buyer should have their own cart
    $cart1 = Cart::where('user_id', $buyer1->id)->first();
    $cart2 = Cart::where('user_id', $buyer2->id)->first();

    expect($cart1->id)->not->toBe($cart2->id);
    expect($cart1->user_id)->toBe($buyer1->id);
    expect($cart2->user_id)->toBe($buyer2->id);
});

test('cart has valid foreign keys (no orphans)', function () {
    $seller = createSeller();
    $buyer = createBuyer();
    $product = createProduct($seller);

    $this->actingAs($buyer, 'api')
        ->postJson('/api/cart/items', ['product_id' => $product->id])
        ->assertStatus(200);

    $cart = Cart::where('user_id', $buyer->id)->with('items.product', 'user')->first();

    // Cart belongs to user
    expect($cart->user)->not->toBeNull();
    expect($cart->user->id)->toBe($buyer->id);

    // Cart item belongs to product
    $item = $cart->items->first();
    expect($item->product)->not->toBeNull();
    expect($item->product->id)->toBe($product->id);
});

// =============================================================================
// Response format
// =============================================================================

test('cart response includes product details in items', function () {
    $seller = createSeller();
    $buyer = createBuyer();
    $product = createProduct($seller, [
        'name' => 'Test Product',
        'price' => 149.99,
        'stock_quantity' => 20,
    ]);

    $response = $this->actingAs($buyer, 'api')
        ->postJson('/api/cart/items', ['product_id' => $product->id]);

    $response->assertStatus(200);

    $item = $response->json('data.items.0');
    expect($item['product'])->not->toBeNull();
    expect($item['product']['id'])->toBe($product->id);
    expect($item['product']['name'])->toBe('Test Product');
    expect($item['product']['price'])->toBe(149.99);
    expect($item['product']['stock_quantity'])->toBe(20);
});

test('user_id in cart response matches the authenticated user', function () {
    $seller = createSeller();
    $buyer = createBuyer();
    $product = createProduct($seller);

    $response = $this->actingAs($buyer, 'api')
        ->postJson('/api/cart/items', ['product_id' => $product->id]);

    $response->assertStatus(200);
    expect($response->json('data.user_id'))->toBe($buyer->id);
});
