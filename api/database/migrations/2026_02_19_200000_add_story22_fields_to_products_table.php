<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Story 2.2: Add description, specs (JSON), category (enum),
     * photo_path (file upload), restock_date to products table.
     */
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->text('description')->nullable()->after('name');
            $table->json('specs')->nullable()->after('description');
            $table->enum('category', [
                'cpu',
                'gpu',
                'ram',
                'stockage',
                'cm',
                'alimentation',
                'boitier',
                'peripheriques',
            ])->nullable()->after('specs');
            $table->string('photo_path')->nullable()->after('photo_url');
            $table->date('restock_date')->nullable()->after('is_active');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn(['description', 'specs', 'category', 'photo_path', 'restock_date']);
        });
    }
};
