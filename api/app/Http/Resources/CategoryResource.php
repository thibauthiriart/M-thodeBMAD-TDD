<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CategoryResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * Story 3.1: Category resource for the public catalogue.
     * Returns slug, label, icon, and description.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        // $this->resource is an array, not a model
        return [
            'slug' => $this->resource['slug'],
            'label' => $this->resource['label'],
            'icon' => $this->resource['icon'],
            'description' => $this->resource['description'],
        ];
    }
}
