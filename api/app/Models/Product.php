<?php

namespace App\Models;

use App\Enums\ProductCategory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Product extends Model
{
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'seller_id',
        'name',
        'description',
        'specs',
        'category',
        'photo_url',
        'photo_path',
        'price',
        'stock_quantity',
        'is_active',
        'restock_date',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'price' => 'decimal:2',
            'stock_quantity' => 'integer',
            'is_active' => 'boolean',
            'specs' => 'array',
            'category' => ProductCategory::class,
            'restock_date' => 'date',
        ];
    }

    /**
     * Get the seller (user) that owns this product.
     */
    public function seller(): BelongsTo
    {
        return $this->belongsTo(User::class, 'seller_id');
    }

    /**
     * Alias for seller() — backward compatibility.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'seller_id');
    }
}
