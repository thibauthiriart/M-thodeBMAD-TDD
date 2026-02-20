<?php

namespace Database\Factories;

use App\Enums\ProductCategory;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Product>
 */
class ProductFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'seller_id' => User::factory()->vendeur(),
            'name' => fake()->words(3, true),
            'description' => fake()->paragraph(),
            'specs' => [
                ['key' => 'Marque', 'value' => fake()->company()],
                ['key' => 'Modèle', 'value' => fake()->word()],
            ],
            'category' => fake()->randomElement(ProductCategory::values()),
            'photo_url' => fake()->optional(0.7)->imageUrl(80, 80),
            'photo_path' => null,
            'price' => fake()->randomFloat(2, 1, 999),
            'stock_quantity' => fake()->numberBetween(0, 100),
            'is_active' => true,
        ];
    }

    /**
     * Set the product as inactive.
     */
    public function inactive(): static
    {
        return $this->state(fn (array $attributes) => [
            'is_active' => false,
        ]);
    }

    /**
     * Set the product as active.
     */
    public function active(): static
    {
        return $this->state(fn (array $attributes) => [
            'is_active' => true,
        ]);
    }

    /**
     * Set the product with no photo.
     */
    public function withoutPhoto(): static
    {
        return $this->state(fn (array $attributes) => [
            'photo_url' => null,
            'photo_path' => null,
        ]);
    }

    /**
     * Set a specific category.
     */
    public function category(ProductCategory $category): static
    {
        return $this->state(fn (array $attributes) => [
            'category' => $category->value,
        ]);
    }
}
