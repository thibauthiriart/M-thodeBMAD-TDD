<?php

namespace App\Http\Requests;

use App\Enums\ProductCategory;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ProductFilterRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     *
     * Public endpoint — always authorized (no auth required).
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * Story 3.3: Filter query parameters for product list endpoint.
     * All filters are optional — when omitted, no filtering is applied.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'category' => ['nullable', 'string', Rule::in(ProductCategory::values())],
            'price_min' => ['nullable', 'numeric', 'min:0'],
            'price_max' => ['nullable', 'numeric', 'min:0'],
            'search' => ['nullable', 'string', 'max:255'],
        ];
    }

    /**
     * Get validated filter values with defaults.
     *
     * @return array{category: ?string, price_min: ?float, price_max: ?float, search: ?string}
     */
    public function filters(): array
    {
        return [
            'category' => $this->validated('category'),
            'price_min' => $this->validated('price_min') !== null ? (float) $this->validated('price_min') : null,
            'price_max' => $this->validated('price_max') !== null ? (float) $this->validated('price_max') : null,
            'search' => $this->validated('search'),
        ];
    }
}
