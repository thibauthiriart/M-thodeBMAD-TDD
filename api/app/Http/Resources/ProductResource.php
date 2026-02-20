<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Storage;

class ProductResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * Returns the fields for Stories 2.1 & 2.2:
     * id, name, description, category, price, stock_quantity, is_active, photo_url, specs
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

        return [
            'id' => $this->id,
            'name' => $this->name,
            'description' => $this->description,
            'category' => $this->category?->value ?? $this->category,
            'specs' => $this->specs,
            'photo_url' => $photoUrl,
            'price' => (float) $this->price,
            'stock_quantity' => (int) $this->stock_quantity,
            'is_active' => (bool) $this->is_active,
        ];
    }
}
