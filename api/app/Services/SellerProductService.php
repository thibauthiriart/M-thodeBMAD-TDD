<?php

namespace App\Services;

use App\Models\Product;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

class SellerProductService
{
    /**
     * Get all products belonging to the given seller.
     *
     * NFR11: Seller only sees their own products (scoped by user_id).
     */
    public function getSellerProducts(User $seller): Collection
    {
        return Product::where('seller_id', $seller->id)
            ->orderBy('created_at', 'desc')
            ->get();
    }

    /**
     * Get a single product belonging to the given seller.
     *
     * NFR11: Ownership check — returns null if the product doesn't belong to the seller.
     *
     * @param User $seller
     * @param int $productId
     * @return Product|null
     */
    public function getSellerProduct(User $seller, int $productId): ?Product
    {
        return Product::where('seller_id', $seller->id)
            ->where('id', $productId)
            ->first();
    }

    /**
     * Create a new product for the given seller.
     *
     * Handles photo upload to storage (local disk for MVP, S3-ready via NFR16).
     * Specs are stored as JSON (flexible schema).
     *
     * @param User $seller
     * @param array $data Validated request data
     * @return Product
     */
    public function createProduct(User $seller, array $data): Product
    {
        $photoPath = null;

        // Handle photo file upload (local disk for MVP, switchable to S3)
        if (isset($data['photo']) && $data['photo'] instanceof UploadedFile) {
            $photoPath = $data['photo']->store('products', 'public');
        }

        // Parse specs from JSON string if provided
        $specs = null;
        if (isset($data['specs'])) {
            $specs = is_string($data['specs']) ? json_decode($data['specs'], true) : $data['specs'];
        }

        return Product::create([
            'seller_id' => $seller->id,
            'name' => $data['name'],
            'description' => $data['description'] ?? null,
            'specs' => $specs,
            'category' => $data['category'] ?? null,
            'price' => $data['price'],
            'stock_quantity' => $data['stock_quantity'],
            'is_active' => $data['is_active'] ?? true,
            'photo_path' => $photoPath,
            'photo_url' => $data['photo_url'] ?? null,
            'restock_date' => $data['restock_date'] ?? null,
        ]);
    }

    /**
     * Toggle the is_active status of a product belonging to the given seller.
     *
     * Story 2.4: Activate/Deactivate Product
     * NFR11: Ownership check — returns null if the product doesn't belong to the seller.
     *
     * @param User $seller
     * @param int $productId
     * @return Product|null Returns null if product not found or not owned by seller
     */
    public function toggleProductStatus(User $seller, int $productId): ?Product
    {
        $product = $this->getSellerProduct($seller, $productId);

        if (!$product) {
            return null;
        }

        $product->update([
            'is_active' => !$product->is_active,
        ]);

        return $product->fresh();
    }

    /**
     * Delete a product belonging to the given seller.
     *
     * Story 2.5: Delete Product
     * NFR11: Ownership check — returns false if the product doesn't belong to the seller.
     * Permanently removes the product (hard delete) and its associated photo from storage.
     *
     * @param User $seller
     * @param int $productId
     * @return bool True if the product was deleted, false if not found or not owned
     */
    public function deleteProduct(User $seller, int $productId): bool
    {
        $product = $this->getSellerProduct($seller, $productId);

        if (!$product) {
            return false;
        }

        // Delete associated photo from storage if it exists
        if ($product->photo_path) {
            Storage::disk('public')->delete($product->photo_path);
        }

        $product->delete();

        return true;
    }

    /**
     * Update an existing product for the given seller.
     *
     * NFR11: Ownership check — only allows updating the seller's own product.
     * Photo is optional on update: if no new photo is provided, the existing one is kept.
     *
     * @param User $seller
     * @param int $productId
     * @param array $data Validated request data
     * @return Product|null Returns null if product not found or not owned by seller
     */
    public function updateProduct(User $seller, int $productId, array $data): ?Product
    {
        $product = $this->getSellerProduct($seller, $productId);

        if (!$product) {
            return null;
        }

        // Handle optional photo replacement
        if (isset($data['photo']) && $data['photo'] instanceof UploadedFile) {
            // Delete old photo if it exists
            if ($product->photo_path) {
                Storage::disk('public')->delete($product->photo_path);
            }
            $data['photo_path'] = $data['photo']->store('products', 'public');
        }
        // Remove the photo key from data (it's not a model attribute)
        unset($data['photo']);

        // Parse specs from JSON string if provided
        if (isset($data['specs'])) {
            $data['specs'] = is_string($data['specs']) ? json_decode($data['specs'], true) : $data['specs'];
        }

        $product->update([
            'name' => $data['name'],
            'description' => $data['description'],
            'category' => $data['category'],
            'price' => $data['price'],
            'stock_quantity' => $data['stock_quantity'],
            'specs' => $data['specs'] ?? $product->specs,
            'photo_path' => $data['photo_path'] ?? $product->photo_path,
            'is_active' => $data['is_active'] ?? $product->is_active,
        ]);

        return $product->fresh();
    }
}
