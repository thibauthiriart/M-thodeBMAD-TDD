<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class AddToCartRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        // Authorization is handled by middleware (auth:api)
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * Story 4.1: AddToCartRequest
     * - product_id: required, must exist in products table
     * - quantity: optional, defaults to 1, must be >= 1
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'product_id' => ['required', 'integer', 'exists:products,id'],
            'quantity' => ['sometimes', 'integer', 'min:1'],
        ];
    }

    /**
     * Get custom messages for validator errors.
     *
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'product_id.required' => 'Le champ produit est obligatoire.',
            'product_id.integer' => 'L\'identifiant du produit doit être un nombre entier.',
            'product_id.exists' => 'Le produit demandé n\'existe pas.',
            'quantity.integer' => 'La quantité doit être un nombre entier.',
            'quantity.min' => 'La quantité doit être au minimum 1.',
        ];
    }
}
