import { execSync } from 'child_process';
import path from 'path';

const API_DIR = path.resolve(__dirname, '..', '..', 'api');

/**
 * Run the E2E test seeder via Laravel Sail.
 * This creates a known set of test data:
 * - User e2e@test.com / password
 * - Entreprise "E2E Test Corp"
 * - Category tree (system categories)
 * - Active period (current month)
 */
export function seedE2EData(): void {
  execSync('./vendor/bin/sail artisan db:seed --class=E2ETestSeeder --force', {
    cwd: API_DIR,
    stdio: 'pipe',
    timeout: 60_000,
  });
}

/**
 * Reset the database and re-seed everything.
 * WARNING: Destructive — drops all tables.
 */
export function resetDatabase(): void {
  execSync('./vendor/bin/sail artisan migrate:fresh --seed --force', {
    cwd: API_DIR,
    stdio: 'pipe',
    timeout: 120_000,
  });
}

/**
 * Run just the E2E seeder (non-destructive, uses updateOrCreate).
 */
export function ensureE2EData(): void {
  seedE2EData();
}
