<?php

namespace App\Http\Requests;

use App\Enums\ProductCategory;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Enum;

class UpdateProductRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        // Authorization is handled by middleware (auth:api + role:vendeur,admin)
        // Ownership check is done in the service layer
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * Photo is optional on update (keep existing if no new photo provided).
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'description' => ['required', 'string'],
            'category' => ['required', 'string', new Enum(ProductCategory::class)],
            'price' => ['required', 'numeric', 'gt:0'],
            'stock_quantity' => ['required', 'integer', 'min:0'],
            'specs' => ['nullable'],
            'photo' => ['nullable', 'file', 'image', 'max:2048'],
            'is_active' => ['sometimes', 'boolean'],
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
            'name.required' => 'Le nom du produit est obligatoire.',
            'name.max' => 'Le nom du produit ne peut pas dépasser 255 caractères.',
            'description.required' => 'La description est obligatoire.',
            'category.required' => 'La catégorie est obligatoire.',
            'category.Illuminate\Validation\Rules\Enum' => 'La catégorie sélectionnée est invalide.',
            'price.required' => 'Le prix est obligatoire.',
            'price.numeric' => 'Le prix doit être un nombre.',
            'price.gt' => 'Le prix doit être supérieur à 0.',
            'stock_quantity.required' => 'La quantité en stock est obligatoire.',
            'stock_quantity.integer' => 'La quantité en stock doit être un nombre entier.',
            'stock_quantity.min' => 'La quantité en stock ne peut pas être négative.',
            'photo.file' => 'La photo doit être un fichier.',
            'photo.image' => 'La photo doit être une image.',
            'photo.max' => 'La photo ne peut pas dépasser 2 Mo.',
        ];
    }
}
