<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Story 3.2: Rename user_id to seller_id on products table.
     *
     * The Playwright E2E tests reference seller_id directly in DB queries.
     * This makes the column name semantically correct for a marketplace.
     */
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            // Drop existing foreign key and index
            $table->dropForeign(['user_id']);
            $table->dropIndex(['user_id']);

            // Rename column
            $table->renameColumn('user_id', 'seller_id');
        });

        Schema::table('products', function (Blueprint $table) {
            // Recreate foreign key and index with new name
            $table->foreign('seller_id')->references('id')->on('users')->onDelete('cascade');
            $table->index('seller_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropForeign(['seller_id']);
            $table->dropIndex(['seller_id']);
            $table->renameColumn('seller_id', 'user_id');
        });

        Schema::table('products', function (Blueprint $table) {
            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
            $table->index('user_id');
        });
    }
};
