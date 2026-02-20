<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CartResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * Story 4.1: Returns the cart with its items.
     * Expected API response shape:
     * {
     *   "data": {
     *     "id": 1,
     *     "user_id": 1,
     *     "items": [
     *       { "id": 1, "product_id": 42, "quantity": 2, "product": {...} }
     *     ],
     *     "total_items": 2
     *   }
     * }
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'user_id' => $this->user_id,
            'items' => $this->items->map(function ($item) {
                return [
                    'id' => $item->id,
                    'product_id' => $item->product_id,
                    'quantity' => (int) $item->quantity,
                    'product' => $item->product ? [
                        'id' => $item->product->id,
                        'name' => $item->product->name,
                        'price' => (float) $item->product->price,
                        'stock_quantity' => (int) $item->product->stock_quantity,
                    ] : null,
                ];
            }),
            'total_items' => $this->items->sum('quantity'),
        ];
    }
}
