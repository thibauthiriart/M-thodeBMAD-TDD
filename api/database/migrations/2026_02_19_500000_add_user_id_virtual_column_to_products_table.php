<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Story 3.4: Add a virtual user_id column mirroring seller_id.
     *
     * The E2E Playwright tests reference p.user_id in raw SQL queries
     * (e.g., JOIN users u ON p.user_id = u.id), but the actual column
     * was renamed to seller_id in a previous migration.
     *
     * A MySQL virtual generated column provides backward compatibility
     * without data duplication or breaking existing PHP code that uses seller_id.
     */
    public function up(): void
    {
        DB::statement('ALTER TABLE products ADD COLUMN user_id BIGINT UNSIGNED GENERATED ALWAYS AS (seller_id) VIRTUAL AFTER seller_id');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::statement('ALTER TABLE products DROP COLUMN user_id');
    }
};
