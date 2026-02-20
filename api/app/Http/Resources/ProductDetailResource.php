<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Storage;

class ProductDetailResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * Story 3.2 AC3: Product detail page resource.
     * Returns all fields needed for the product detail view.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        // Generate photo_url from photo_path (storage) or fall back to photo_url field
        $photoUrl = null;
        if ($this->photo_path) {
            $photoUrl = Storage::disk('public')->url($this->photo_path);
        } elseif ($this->photo_url) {
            $photoUrl = $this->photo_url;
        }

        // Transform specs from {key: value} object to [{key, value}] array
        $specs = $this->specs;
        if (is_array($specs) && !empty($specs)) {
            // Check if specs are already in [{key, value}] format
            $firstItem = reset($specs);
            if (!is_array($firstItem) || !isset($firstItem['key'])) {
                // Convert {key: value} object to [{key, value}] array
                $specs = array_map(function ($value, $key) {
                    return ['key' => $key, 'value' => (string) $value];
                }, $specs, array_keys($specs));
                $specs = array_values($specs);
            }
        } else {
            $specs = [];
        }

        return [
            'id' => $this->id,
            'name' => $this->name,
            'description' => $this->description,
            'category' => $this->category?->value ?? $this->category,
            'specs' => $specs,
            'price' => (float) $this->price,
            'stock_quantity' => (int) $this->stock_quantity,
            'seller_name' => $this->seller?->name ?? 'Inconnu',
            'photo_url' => $photoUrl,
            'is_active' => (bool) $this->is_active,
            'restock_date' => $this->restock_date?->toDateString(),
        ];
    }
}
