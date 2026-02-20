<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Storage;

class CatalogProductResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * Story 3.1 AC2: Public catalogue product resource.
     * Returns: id, name, description, category, price, stock_quantity, seller_name, photo_url
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
            'price' => (float) $this->price,
            'stock_quantity' => (int) $this->stock_quantity,
            'seller_name' => $this->seller?->name ?? $this->user?->name ?? 'Inconnu',
            'photo_url' => $photoUrl,
            'is_active' => (bool) $this->is_active,
        ];
    }
}
