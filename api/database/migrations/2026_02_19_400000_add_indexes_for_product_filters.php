<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Story 3.3: Add indexes on price and category columns for filter performance.
     *
     * NFR4: Filters must return results in under 1 second.
     * These indexes optimize WHERE clauses used by category, price range,
     * and combined filter queries.
     */
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->index('price', 'products_price_index');
            $table->index('category', 'products_category_index');
            $table->index('is_active', 'products_is_active_index');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropIndex('products_price_index');
            $table->dropIndex('products_category_index');
            $table->dropIndex('products_is_active_index');
        });
    }
};
