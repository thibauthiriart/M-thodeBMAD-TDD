<?php

namespace App\Services;

use App\Models\Cart;
use App\Models\CartItem;
use App\Models\Product;
use App\Models\User;
use Illuminate\Validation\ValidationException;

class CartService
{
    /**
     * Add a product to the user's cart.
     *
     * Story 4.1:
     * - If the user doesn't have a cart yet, create one (NFR18: persisted in DB)
     * - If the product is already in the cart, increment quantity
     * - If not, create a new CartItem with quantity 1
     * - Check that the product is active and in stock
     *
     * @param User $user The authenticated buyer
     * @param int $productId The product to add
     * @param int $quantity The quantity to add (default 1)
     * @return Cart The updated cart with items loaded
     *
     * @throws ValidationException If product is out of stock or inactive
     */
    public function addItem(User $user, int $productId, int $quantity = 1): Cart
    {
        // Validate the product exists, is active, and is in stock
        $product = Product::find($productId);

        if (!$product) {
            throw ValidationException::withMessages([
                'product_id' => ['Le produit demandé n\'existe pas.'],
            ]);
        }

        if (!$product->is_active) {
            throw ValidationException::withMessages([
                'product_id' => ['Ce produit n\'est pas disponible.'],
            ]);
        }

        if ($product->stock_quantity <= 0) {
            throw ValidationException::withMessages([
                'product_id' => ['Ce produit est en rupture de stock.'],
            ]);
        }

        // Get or create the cart for this user
        $cart = Cart::firstOrCreate(['user_id' => $user->id]);

        // Check if the product is already in the cart
        $cartItem = CartItem::where('cart_id', $cart->id)
            ->where('product_id', $productId)
            ->first();

        if ($cartItem) {
            // Product already in cart: increment quantity
            $cartItem->update([
                'quantity' => $cartItem->quantity + $quantity,
            ]);
        } else {
            // Product not in cart: create new CartItem
            CartItem::create([
                'cart_id' => $cart->id,
                'product_id' => $productId,
                'quantity' => $quantity,
            ]);
        }

        // Return the cart with fresh items loaded
        return $cart->load('items.product');
    }

    /**
     * Get the user's cart with all items.
     *
     * @param User $user The authenticated buyer
     * @return Cart|null The cart or null if no cart exists
     */
    public function getCart(User $user): ?Cart
    {
        return Cart::where('user_id', $user->id)
            ->with('items.product')
            ->first();
    }
}
