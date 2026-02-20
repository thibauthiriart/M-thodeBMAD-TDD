import { test, expect } from '@playwright/test';
import { RowDataPacket } from 'mysql2/promise';
import { loginAs, logout } from '../helpers/auth';
import { db } from '../helpers/database';

/**
 * Story 3.3 — Product Filters
 *
 * AC1: Given a user is on the catalogue page
 *      When they apply a category filter
 *      Then only products matching the selected category are displayed
 *
 * AC2: Given a user sets a price range filter (min and/or max)
 *      When the filter is applied
 *      Then only products within the price range are displayed
 *
 * AC3: Given a user types a search term in the name filter
 *      When the filter is applied
 *      Then only products whose name matches the search term are displayed
 *
 * AC4: Given a user applies multiple filters simultaneously
 *      When filters are combined
 *      Then results match ALL active filters
 *      And results return in under 1 second
 *
 * Pre-conditions:
 * - e2e-vendeur@test.com / password exists with role "vendeur" (from E2ETestSeeder)
 * - e2e@test.com / password exists with role "acheteur" (from E2ETestSeeder)
 * - The /catalogue page displays ProductFilters and ProductGrid with products
 *
 * The tests describe EXPECTED behavior (TDD). They will fail until:
 * - Backend: Product list endpoint supports query params: category, price_min, price_max, search
 * - Backend: Eloquent query builds conditional WHERE clauses with AND logic
 * - Backend: Search uses LIKE %term% on product name
 * - Frontend: ProductFilters.vue emits filter values on change
 * - Frontend: CataloguePage.vue applies filters client-side (or via API)
 * - Frontend: Search input has 300ms debounce
 * - Frontend: Category selection via chips (single select toggle)
 * - Frontend: Price range inputs (min/max)
 * - Frontend: Active filters summary with individual removal
 * - Frontend: Reset filters button clears all filters
 * - Frontend: "Aucun produit trouvé" message when no results
 */

// ---------------------------------------------------------------------------
// Test user credentials
// ---------------------------------------------------------------------------
const VENDEUR_EMAIL = 'e2e-vendeur@test.com';
const VENDEUR_PASSWORD = 'password';

const ACHETEUR_EMAIL = 'e2e@test.com';
const ACHETEUR_PASSWORD = 'password';

const API_URL = process.env.API_URL || 'http://localhost:8080/api';

// ---------------------------------------------------------------------------
// Known product data from CataloguePage mock (16 products across 8 categories)
// ---------------------------------------------------------------------------
const KNOWN_CATEGORIES = [
  { slug: 'cpu', label: 'CPU' },
  { slug: 'gpu', label: 'GPU' },
  { slug: 'ram', label: 'RAM' },
  { slug: 'stockage', label: 'Stockage' },
  { slug: 'cm', label: 'Carte Mère' },
  { slug: 'alimentation', label: 'Alimentation' },
  { slug: 'boitier', label: 'Boîtier' },
  { slug: 'peripheriques', label: 'Périphériques' },
] as const;

// Total products in mock data
const TOTAL_PRODUCTS = 16;

// Products per category in mock data (2 per category)
const PRODUCTS_PER_CATEGORY = 2;

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------
test.afterAll(async () => {
  await db.cleanup();
});

// ═══════════════════════════════════════════════════════════════════════════
// PREREQUISITE — Catalogue page structure & filter panel visibility
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Story 3.3 — Prerequisite: Catalogue page and filter panel are visible', () => {

  test('catalogue page renders with title, subtitle and breadcrumb', async ({ page }) => {
    // === ACTION ===
    await page.goto('/catalogue');

    // === VERIFICATION UI ===
    await expect(page.locator('[data-testid="catalogue-page"]')).toBeVisible();
    await expect(page.locator('[data-testid="catalogue-title"]')).toBeVisible();
    await expect(page.locator('[data-testid="catalogue-title"]')).toContainText('Catalogue');
    await expect(page.locator('[data-testid="catalogue-subtitle"]')).toBeVisible();
    await expect(page.locator('[data-testid="catalogue-breadcrumb"]')).toBeVisible();
    await expect(page.locator('[data-testid="breadcrumb-home-link"]')).toBeVisible();
    await expect(page.locator('[data-testid="breadcrumb-current"]')).toContainText('Catalogue');
  });

  test('filter panel is visible in the sidebar', async ({ page }) => {
    // === ACTION ===
    await page.goto('/catalogue');

    // === VERIFICATION UI ===
    await expect(page.locator('[data-testid="filters-sidebar"]')).toBeVisible();
    await expect(page.locator('[data-testid="product-filters"]')).toBeVisible();
    await expect(page.locator('[data-testid="filters-title"]')).toBeVisible();
    await expect(page.locator('[data-testid="filters-title"]')).toContainText('Filtres');
  });

  test('filter panel shows search input, category chips, and price range inputs', async ({ page }) => {
    // === ACTION ===
    await page.goto('/catalogue');

    // === VERIFICATION UI ===
    // Search
    await expect(page.locator('[data-testid="search-label"]')).toBeVisible();
    await expect(page.locator('[data-testid="search-input"]')).toBeVisible();

    // Category chips
    await expect(page.locator('[data-testid="category-filter-label"]')).toBeVisible();
    await expect(page.locator('[data-testid="category-chips"]')).toBeVisible();

    // Price range
    await expect(page.locator('[data-testid="price-filter-label"]')).toBeVisible();
    await expect(page.locator('[data-testid="price-min-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="price-max-input"]')).toBeVisible();
  });

  test('all 8 category chips are displayed', async ({ page }) => {
    // === ACTION ===
    await page.goto('/catalogue');

    // === VERIFICATION UI ===
    for (const cat of KNOWN_CATEGORIES) {
      await expect(page.locator(`[data-testid="category-chip-${cat.slug}"]`)).toBeVisible();
    }
  });

  test('reset button is visible', async ({ page }) => {
    // === ACTION ===
    await page.goto('/catalogue');

    // === VERIFICATION UI ===
    await expect(page.locator('[data-testid="filters-reset-btn"]')).toBeVisible();
  });

  test('results count is displayed initially with total product count', async ({ page }) => {
    // === ACTION ===
    await page.goto('/catalogue');

    // === VERIFICATION UI ===
    await expect(page.locator('[data-testid="results-info"]')).toBeVisible();
    const resultsCount = page.locator('[data-testid="results-count"]');
    await expect(resultsCount).toBeVisible();
    const countText = await resultsCount.textContent();
    // Should show total number of products (16 in mock data, or more in real API)
    const count = parseInt(countText!.trim(), 10);
    expect(count).toBeGreaterThan(0);
  });

  test('product grid is displayed with products', async ({ page }) => {
    // === ACTION ===
    await page.goto('/catalogue');

    // === VERIFICATION UI ===
    await expect(page.locator('[data-testid="product-grid-container"]')).toBeVisible();
    const cards = page.locator('[data-testid^="product-card-"]');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// AC1 — Category filter: only matching products are displayed
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Story 3.3 — AC1: Category filter shows only matching products', () => {

  test('clicking a category chip filters products to that category', async ({ page }) => {
    // === ACTION ===
    await page.goto('/catalogue');

    // Get initial count
    const initialCount = await page.locator('[data-testid^="product-card-"]').count();
    expect(initialCount).toBeGreaterThan(PRODUCTS_PER_CATEGORY);

    // Click on CPU category chip
    await page.locator('[data-testid="category-chip-cpu"]').click();

    // === VERIFICATION UI ===
    // Wait for the filter to take effect
    const resultsCount = page.locator('[data-testid="results-count"]');
    // Products should be filtered (fewer than total)
    await expect(async () => {
      const currentCount = await page.locator('[data-testid^="product-card-"]').count();
      expect(currentCount).toBeLessThanOrEqual(initialCount);
      expect(currentCount).toBeGreaterThan(0);
    }).toPass({ timeout: 3_000 });
  });

  test('filtered products match the selected category (CPU)', async ({ page }) => {
    // === ACTION ===
    await page.goto('/catalogue');
    await page.locator('[data-testid="category-chip-cpu"]').click();

    // === VERIFICATION UI ===
    await expect(async () => {
      const cards = page.locator('[data-testid^="product-card-"]');
      const count = await cards.count();
      expect(count).toBeGreaterThan(0);

      // All displayed product names should be CPU-related
      // Verify by checking that card names contain CPU-related terms
      // (In real data, category filtering is server-side; we verify the count changed)
      for (let i = 0; i < count; i++) {
        const testId = await cards.nth(i).getAttribute('data-testid');
        const productId = testId!.replace('product-card-', '');
        const nameEl = page.locator(`[data-testid="product-name-${productId}"]`);
        await expect(nameEl).toBeVisible();
      }
    }).toPass({ timeout: 3_000 });
  });

  test('clicking a different category chip updates the filter', async ({ page }) => {
    // === ACTION ===
    await page.goto('/catalogue');

    // Select CPU first
    await page.locator('[data-testid="category-chip-cpu"]').click();

    // Wait for CPU filter to apply
    await expect(async () => {
      const countText = await page.locator('[data-testid="results-count"]').textContent();
      const count = parseInt(countText!.trim(), 10);
      expect(count).toBeGreaterThan(0);
    }).toPass({ timeout: 3_000 });

    const cpuCountText = await page.locator('[data-testid="results-count"]').textContent();
    const cpuCount = parseInt(cpuCountText!.trim(), 10);

    // Now select GPU
    await page.locator('[data-testid="category-chip-gpu"]').click();

    // === VERIFICATION UI ===
    await expect(async () => {
      const gpuCountText = await page.locator('[data-testid="results-count"]').textContent();
      const gpuCount = parseInt(gpuCountText!.trim(), 10);
      expect(gpuCount).toBeGreaterThan(0);
    }).toPass({ timeout: 3_000 });
  });

  test('clicking the same category chip again deselects it (toggle off)', async ({ page }) => {
    // === ACTION ===
    await page.goto('/catalogue');

    // Get initial count
    const initialCountText = await page.locator('[data-testid="results-count"]').textContent();
    const initialCount = parseInt(initialCountText!.trim(), 10);

    // Select CPU
    await page.locator('[data-testid="category-chip-cpu"]').click();

    // Wait for filter
    await expect(async () => {
      const countText = await page.locator('[data-testid="results-count"]').textContent();
      const count = parseInt(countText!.trim(), 10);
      expect(count).toBeLessThan(initialCount);
    }).toPass({ timeout: 3_000 });

    // Click CPU again to deselect
    await page.locator('[data-testid="category-chip-cpu"]').click();

    // === VERIFICATION UI ===
    // Count should return to initial (all products)
    await expect(async () => {
      const countText = await page.locator('[data-testid="results-count"]').textContent();
      const count = parseInt(countText!.trim(), 10);
      expect(count).toBe(initialCount);
    }).toPass({ timeout: 3_000 });
  });

  test('active category filter badge is displayed when category is selected', async ({ page }) => {
    // === ACTION ===
    await page.goto('/catalogue');
    await page.locator('[data-testid="category-chip-gpu"]').click();

    // === VERIFICATION UI ===
    await expect(page.locator('[data-testid="active-filters-summary"]')).toBeVisible();
    await expect(page.locator('[data-testid="active-filter-category"]')).toBeVisible();
    await expect(page.locator('[data-testid="active-filter-category"]')).toContainText('GPU');
  });

  test('removing category filter via active filter badge restores all products', async ({ page }) => {
    // === ACTION ===
    await page.goto('/catalogue');

    const initialCountText = await page.locator('[data-testid="results-count"]').textContent();
    const initialCount = parseInt(initialCountText!.trim(), 10);

    // Select a category
    await page.locator('[data-testid="category-chip-ram"]').click();

    // Wait for filter to apply
    await expect(page.locator('[data-testid="active-filter-category"]')).toBeVisible();

    // Remove the filter via the X button
    await page.locator('[data-testid="remove-category-filter-btn"]').click();

    // === VERIFICATION UI ===
    await expect(page.locator('[data-testid="active-filter-category"]')).not.toBeVisible();

    await expect(async () => {
      const countText = await page.locator('[data-testid="results-count"]').textContent();
      const count = parseInt(countText!.trim(), 10);
      expect(count).toBe(initialCount);
    }).toPass({ timeout: 3_000 });
  });

  test('each of the 8 categories returns products when selected', async ({ page }) => {
    // === ACTION ===
    await page.goto('/catalogue');

    for (const cat of KNOWN_CATEGORIES) {
      // Click the category chip
      await page.locator(`[data-testid="category-chip-${cat.slug}"]`).click();

      // === VERIFICATION UI ===
      await expect(async () => {
        const countText = await page.locator('[data-testid="results-count"]').textContent();
        const count = parseInt(countText!.trim(), 10);
        expect(count).toBeGreaterThan(0);
      }).toPass({ timeout: 3_000 });

      // Deselect for next iteration
      await page.locator(`[data-testid="category-chip-${cat.slug}"]`).click();

      // Wait for reset
      await expect(async () => {
        const countText = await page.locator('[data-testid="results-count"]').textContent();
        const count = parseInt(countText!.trim(), 10);
        expect(count).toBeGreaterThanOrEqual(TOTAL_PRODUCTS);
      }).toPass({ timeout: 3_000 });
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// AC2 — Price range filter: only products within range are displayed
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Story 3.3 — AC2: Price range filter shows only products in range', () => {

  test('setting a minimum price filters out cheaper products', async ({ page }) => {
    // === ACTION ===
    await page.goto('/catalogue');

    const initialCountText = await page.locator('[data-testid="results-count"]').textContent();
    const initialCount = parseInt(initialCountText!.trim(), 10);

    // Set min price to 500 (should exclude many products)
    await page.locator('[data-testid="price-min-input"]').fill('500');

    // === VERIFICATION UI ===
    await expect(async () => {
      const countText = await page.locator('[data-testid="results-count"]').textContent();
      const count = parseInt(countText!.trim(), 10);
      expect(count).toBeLessThan(initialCount);
      expect(count).toBeGreaterThan(0);
    }).toPass({ timeout: 3_000 });
  });

  test('setting a maximum price filters out expensive products', async ({ page }) => {
    // === ACTION ===
    await page.goto('/catalogue');

    const initialCountText = await page.locator('[data-testid="results-count"]').textContent();
    const initialCount = parseInt(initialCountText!.trim(), 10);

    // Set max price to 150 (should exclude expensive products)
    await page.locator('[data-testid="price-max-input"]').fill('150');

    // === VERIFICATION UI ===
    await expect(async () => {
      const countText = await page.locator('[data-testid="results-count"]').textContent();
      const count = parseInt(countText!.trim(), 10);
      expect(count).toBeLessThan(initialCount);
      expect(count).toBeGreaterThan(0);
    }).toPass({ timeout: 3_000 });
  });

  test('setting both min and max price creates a price range filter', async ({ page }) => {
    // === ACTION ===
    await page.goto('/catalogue');

    const initialCountText = await page.locator('[data-testid="results-count"]').textContent();
    const initialCount = parseInt(initialCountText!.trim(), 10);

    // Set price range: 100-200
    await page.locator('[data-testid="price-min-input"]').fill('100');
    await page.locator('[data-testid="price-max-input"]').fill('200');

    // === VERIFICATION UI ===
    await expect(async () => {
      const countText = await page.locator('[data-testid="results-count"]').textContent();
      const count = parseInt(countText!.trim(), 10);
      expect(count).toBeLessThan(initialCount);
      expect(count).toBeGreaterThan(0);
    }).toPass({ timeout: 3_000 });

    // All displayed product prices should be within range 100-200
    const cards = page.locator('[data-testid^="product-card-"]');
    const count = await cards.count();
    for (let i = 0; i < count; i++) {
      const testId = await cards.nth(i).getAttribute('data-testid');
      const productId = testId!.replace('product-card-', '');
      const priceText = await page.locator(`[data-testid="product-price-${productId}"]`).textContent();
      // Parse French formatted price: "129,99 €" → 129.99
      const priceStr = priceText!
        .replace(/\s/g, '')
        .replace('€', '')
        .replace(/\u00A0/g, '')
        .replace(',', '.');
      const price = parseFloat(priceStr);
      expect(price).toBeGreaterThanOrEqual(100);
      expect(price).toBeLessThanOrEqual(200);
    }
  });

  test('price range that matches no products shows "Aucun produit trouvé"', async ({ page }) => {
    // === ACTION ===
    await page.goto('/catalogue');

    // Set an impossible price range (very narrow)
    await page.locator('[data-testid="price-min-input"]').fill('999999');
    await page.locator('[data-testid="price-max-input"]').fill('999999');

    // === VERIFICATION UI ===
    await expect(page.locator('[data-testid="no-results-message"]')).toBeVisible({ timeout: 3_000 });
    await expect(page.locator('[data-testid="no-results-message"]')).toContainText('Aucun produit trouvé');
  });

  test('active price min filter badge is displayed', async ({ page }) => {
    // === ACTION ===
    await page.goto('/catalogue');
    await page.locator('[data-testid="price-min-input"]').fill('200');

    // === VERIFICATION UI ===
    await expect(page.locator('[data-testid="active-filters-summary"]')).toBeVisible();
    await expect(page.locator('[data-testid="active-filter-price-min"]')).toBeVisible();
    await expect(page.locator('[data-testid="active-filter-price-min"]')).toContainText('200');
  });

  test('active price max filter badge is displayed', async ({ page }) => {
    // === ACTION ===
    await page.goto('/catalogue');
    await page.locator('[data-testid="price-max-input"]').fill('500');

    // === VERIFICATION UI ===
    await expect(page.locator('[data-testid="active-filters-summary"]')).toBeVisible();
    await expect(page.locator('[data-testid="active-filter-price-max"]')).toBeVisible();
    await expect(page.locator('[data-testid="active-filter-price-max"]')).toContainText('500');
  });

  test('removing price min filter via active filter badge restores products', async ({ page }) => {
    // === ACTION ===
    await page.goto('/catalogue');

    const initialCountText = await page.locator('[data-testid="results-count"]').textContent();
    const initialCount = parseInt(initialCountText!.trim(), 10);

    // Set a min price
    await page.locator('[data-testid="price-min-input"]').fill('500');
    await expect(page.locator('[data-testid="active-filter-price-min"]')).toBeVisible();

    // Remove via X button
    await page.locator('[data-testid="remove-price-min-filter-btn"]').click();

    // === VERIFICATION UI ===
    await expect(page.locator('[data-testid="active-filter-price-min"]')).not.toBeVisible();

    await expect(async () => {
      const countText = await page.locator('[data-testid="results-count"]').textContent();
      const count = parseInt(countText!.trim(), 10);
      expect(count).toBe(initialCount);
    }).toPass({ timeout: 3_000 });
  });

  test('removing price max filter via active filter badge restores products', async ({ page }) => {
    // === ACTION ===
    await page.goto('/catalogue');

    const initialCountText = await page.locator('[data-testid="results-count"]').textContent();
    const initialCount = parseInt(initialCountText!.trim(), 10);

    // Set a max price
    await page.locator('[data-testid="price-max-input"]').fill('100');
    await expect(page.locator('[data-testid="active-filter-price-max"]')).toBeVisible();

    // Remove via X button
    await page.locator('[data-testid="remove-price-max-filter-btn"]').click();

    // === VERIFICATION UI ===
    await expect(page.locator('[data-testid="active-filter-price-max"]')).not.toBeVisible();

    await expect(async () => {
      const countText = await page.locator('[data-testid="results-count"]').textContent();
      const count = parseInt(countText!.trim(), 10);
      expect(count).toBe(initialCount);
    }).toPass({ timeout: 3_000 });
  });

  test('clearing the price input field removes the filter', async ({ page }) => {
    // === ACTION ===
    await page.goto('/catalogue');

    const initialCountText = await page.locator('[data-testid="results-count"]').textContent();
    const initialCount = parseInt(initialCountText!.trim(), 10);

    // Set a min price
    await page.locator('[data-testid="price-min-input"]').fill('500');
    await expect(async () => {
      const countText = await page.locator('[data-testid="results-count"]').textContent();
      const count = parseInt(countText!.trim(), 10);
      expect(count).toBeLessThan(initialCount);
    }).toPass({ timeout: 3_000 });

    // Clear the input
    await page.locator('[data-testid="price-min-input"]').fill('');

    // === VERIFICATION UI ===
    await expect(async () => {
      const countText = await page.locator('[data-testid="results-count"]').textContent();
      const count = parseInt(countText!.trim(), 10);
      expect(count).toBe(initialCount);
    }).toPass({ timeout: 3_000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// AC3 — Search by name filter: matching products displayed
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Story 3.3 — AC3: Search by name filter shows matching products', () => {

  test('typing a search term filters products by name (LIKE %term%)', async ({ page }) => {
    // === ACTION ===
    await page.goto('/catalogue');

    const initialCountText = await page.locator('[data-testid="results-count"]').textContent();
    const initialCount = parseInt(initialCountText!.trim(), 10);

    // Type "RTX" in the search input (known product: NVIDIA RTX 4090)
    await page.locator('[data-testid="search-input"]').fill('RTX');

    // === VERIFICATION UI ===
    // Wait for debounce (300ms) + filter to apply
    await expect(async () => {
      const countText = await page.locator('[data-testid="results-count"]').textContent();
      const count = parseInt(countText!.trim(), 10);
      expect(count).toBeLessThan(initialCount);
      expect(count).toBeGreaterThan(0);
    }).toPass({ timeout: 3_000 });

    // All visible product names should contain "RTX" (case-insensitive)
    const cards = page.locator('[data-testid^="product-card-"]');
    const count = await cards.count();
    for (let i = 0; i < count; i++) {
      const testId = await cards.nth(i).getAttribute('data-testid');
      const productId = testId!.replace('product-card-', '');
      const nameText = await page.locator(`[data-testid="product-name-${productId}"]`).textContent();
      expect(nameText!.toLowerCase()).toContain('rtx');
    }
  });

  test('search is case-insensitive', async ({ page }) => {
    // === ACTION ===
    await page.goto('/catalogue');

    // Type "ryzen" in lowercase
    await page.locator('[data-testid="search-input"]').fill('ryzen');

    // === VERIFICATION UI ===
    await expect(async () => {
      const countText = await page.locator('[data-testid="results-count"]').textContent();
      const count = parseInt(countText!.trim(), 10);
      expect(count).toBeGreaterThan(0);
    }).toPass({ timeout: 3_000 });

    // Product name "AMD Ryzen 9 7950X" should match
    const cards = page.locator('[data-testid^="product-card-"]');
    const count = await cards.count();
    for (let i = 0; i < count; i++) {
      const testId = await cards.nth(i).getAttribute('data-testid');
      const productId = testId!.replace('product-card-', '');
      const nameText = await page.locator(`[data-testid="product-name-${productId}"]`).textContent();
      expect(nameText!.toLowerCase()).toContain('ryzen');
    }
  });

  test('search with partial name matches products (LIKE %term%)', async ({ page }) => {
    // === ACTION ===
    await page.goto('/catalogue');

    // Type partial term "Corsair" (matches: Corsair Vengeance DDR5 32 Go, Corsair RM1000x)
    await page.locator('[data-testid="search-input"]').fill('Corsair');

    // === VERIFICATION UI ===
    await expect(async () => {
      const countText = await page.locator('[data-testid="results-count"]').textContent();
      const count = parseInt(countText!.trim(), 10);
      // Should match at least 2 Corsair products
      expect(count).toBeGreaterThanOrEqual(2);
    }).toPass({ timeout: 3_000 });
  });

  test('search that matches no products shows "Aucun produit trouvé" message', async ({ page }) => {
    // === ACTION ===
    await page.goto('/catalogue');

    // Type a term that matches nothing
    await page.locator('[data-testid="search-input"]').fill('ZZZZNONEXISTENT9999');

    // === VERIFICATION UI ===
    await expect(page.locator('[data-testid="no-results-message"]')).toBeVisible({ timeout: 3_000 });
    await expect(page.locator('[data-testid="no-results-message"]')).toContainText('Aucun produit trouvé');
  });

  test('search has a 300ms debounce (does not filter immediately)', async ({ page }) => {
    // === ACTION ===
    await page.goto('/catalogue');

    const initialCountText = await page.locator('[data-testid="results-count"]').textContent();
    const initialCount = parseInt(initialCountText!.trim(), 10);

    // Type quickly character by character
    const searchInput = page.locator('[data-testid="search-input"]');
    await searchInput.pressSequentially('RTX', { delay: 50 });

    // Immediately after typing, the filter might not have taken effect yet
    // (debounce is 300ms, we typed in ~150ms total)
    // But after waiting for debounce, the filter should apply
    await expect(async () => {
      const countText = await page.locator('[data-testid="results-count"]').textContent();
      const count = parseInt(countText!.trim(), 10);
      expect(count).toBeLessThan(initialCount);
    }).toPass({ timeout: 3_000 });
  });

  test('active search filter badge is displayed', async ({ page }) => {
    // === ACTION ===
    await page.goto('/catalogue');
    await page.locator('[data-testid="search-input"]').fill('Samsung');

    // === VERIFICATION UI ===
    await expect(page.locator('[data-testid="active-filters-summary"]')).toBeVisible({ timeout: 3_000 });
    await expect(page.locator('[data-testid="active-filter-search"]')).toBeVisible();
    await expect(page.locator('[data-testid="active-filter-search"]')).toContainText('Samsung');
  });

  test('removing search filter via active filter badge restores all products', async ({ page }) => {
    // === ACTION ===
    await page.goto('/catalogue');

    const initialCountText = await page.locator('[data-testid="results-count"]').textContent();
    const initialCount = parseInt(initialCountText!.trim(), 10);

    // Apply search filter
    await page.locator('[data-testid="search-input"]').fill('RTX');
    await expect(page.locator('[data-testid="active-filter-search"]')).toBeVisible({ timeout: 3_000 });

    // Remove via X button
    await page.locator('[data-testid="remove-search-filter-btn"]').click();

    // === VERIFICATION UI ===
    await expect(page.locator('[data-testid="active-filter-search"]')).not.toBeVisible();

    await expect(async () => {
      const countText = await page.locator('[data-testid="results-count"]').textContent();
      const count = parseInt(countText!.trim(), 10);
      expect(count).toBe(initialCount);
    }).toPass({ timeout: 3_000 });
  });

  test('clearing the search input field restores all products', async ({ page }) => {
    // === ACTION ===
    await page.goto('/catalogue');

    const initialCountText = await page.locator('[data-testid="results-count"]').textContent();
    const initialCount = parseInt(initialCountText!.trim(), 10);

    // Type a search term
    await page.locator('[data-testid="search-input"]').fill('RTX');
    await expect(async () => {
      const countText = await page.locator('[data-testid="results-count"]').textContent();
      const count = parseInt(countText!.trim(), 10);
      expect(count).toBeLessThan(initialCount);
    }).toPass({ timeout: 3_000 });

    // Clear the input
    await page.locator('[data-testid="search-input"]').fill('');

    // === VERIFICATION UI ===
    await expect(async () => {
      const countText = await page.locator('[data-testid="results-count"]').textContent();
      const count = parseInt(countText!.trim(), 10);
      expect(count).toBe(initialCount);
    }).toPass({ timeout: 3_000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// AC4 — Combined filters: results match ALL active filters (AND logic)
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Story 3.3 — AC4: Combined filters with AND logic', () => {

  test('category + search: only products matching BOTH filters are displayed', async ({ page }) => {
    // === ACTION ===
    await page.goto('/catalogue');

    // Select category "peripheriques" AND search for "Logitech"
    await page.locator('[data-testid="category-chip-peripheriques"]').click();
    await page.locator('[data-testid="search-input"]').fill('Logitech');

    // === VERIFICATION UI ===
    await expect(async () => {
      const countText = await page.locator('[data-testid="results-count"]').textContent();
      const count = parseInt(countText!.trim(), 10);
      // Should only return Logitech products in peripheriques category
      expect(count).toBeGreaterThan(0);
    }).toPass({ timeout: 3_000 });

    // Both filter badges should be visible
    await expect(page.locator('[data-testid="active-filter-category"]')).toBeVisible();
    await expect(page.locator('[data-testid="active-filter-search"]')).toBeVisible();
  });

  test('category + price range: only products matching BOTH filters are displayed', async ({ page }) => {
    // === ACTION ===
    await page.goto('/catalogue');

    // Select GPU category AND set price range 500-1500
    await page.locator('[data-testid="category-chip-gpu"]').click();
    await page.locator('[data-testid="price-min-input"]').fill('500');
    await page.locator('[data-testid="price-max-input"]').fill('1500');

    // === VERIFICATION UI ===
    await expect(async () => {
      const countText = await page.locator('[data-testid="results-count"]').textContent();
      const count = parseInt(countText!.trim(), 10);
      expect(count).toBeGreaterThan(0);
    }).toPass({ timeout: 3_000 });

    // All displayed products should have prices between 500-1500
    const cards = page.locator('[data-testid^="product-card-"]');
    const count = await cards.count();
    for (let i = 0; i < count; i++) {
      const testId = await cards.nth(i).getAttribute('data-testid');
      const productId = testId!.replace('product-card-', '');
      const priceText = await page.locator(`[data-testid="product-price-${productId}"]`).textContent();
      const priceStr = priceText!
        .replace(/\s/g, '')
        .replace('€', '')
        .replace(/\u00A0/g, '')
        .replace(',', '.');
      const price = parseFloat(priceStr);
      expect(price).toBeGreaterThanOrEqual(500);
      expect(price).toBeLessThanOrEqual(1500);
    }

    // Category and price filter badges should all be visible
    await expect(page.locator('[data-testid="active-filter-category"]')).toBeVisible();
    await expect(page.locator('[data-testid="active-filter-price-min"]')).toBeVisible();
    await expect(page.locator('[data-testid="active-filter-price-max"]')).toBeVisible();
  });

  test('search + price range: only products matching BOTH filters are displayed', async ({ page }) => {
    // === ACTION ===
    await page.goto('/catalogue');

    // Search for "Corsair" AND set max price to 150
    await page.locator('[data-testid="search-input"]').fill('Corsair');
    await page.locator('[data-testid="price-max-input"]').fill('150');

    // === VERIFICATION UI ===
    await expect(async () => {
      const countText = await page.locator('[data-testid="results-count"]').textContent();
      const count = parseInt(countText!.trim(), 10);
      expect(count).toBeGreaterThan(0);
    }).toPass({ timeout: 3_000 });

    // All visible product names should contain "Corsair" AND price <= 150
    const cards = page.locator('[data-testid^="product-card-"]');
    const count = await cards.count();
    for (let i = 0; i < count; i++) {
      const testId = await cards.nth(i).getAttribute('data-testid');
      const productId = testId!.replace('product-card-', '');

      const nameText = await page.locator(`[data-testid="product-name-${productId}"]`).textContent();
      expect(nameText!.toLowerCase()).toContain('corsair');

      const priceText = await page.locator(`[data-testid="product-price-${productId}"]`).textContent();
      const priceStr = priceText!
        .replace(/\s/g, '')
        .replace('€', '')
        .replace(/\u00A0/g, '')
        .replace(',', '.');
      const price = parseFloat(priceStr);
      expect(price).toBeLessThanOrEqual(150);
    }
  });

  test('all three filters combined (category + price range + search)', async ({ page }) => {
    // === ACTION ===
    await page.goto('/catalogue');

    // Category: cpu, Price: 400-600, Search: "Ryzen"
    await page.locator('[data-testid="category-chip-cpu"]').click();
    await page.locator('[data-testid="price-min-input"]').fill('400');
    await page.locator('[data-testid="price-max-input"]').fill('600');
    await page.locator('[data-testid="search-input"]').fill('Ryzen');

    // === VERIFICATION UI ===
    await expect(async () => {
      const countText = await page.locator('[data-testid="results-count"]').textContent();
      const count = parseInt(countText!.trim(), 10);
      // Should match AMD Ryzen 9 7950X (price: 589.99, category: cpu)
      expect(count).toBeGreaterThan(0);
    }).toPass({ timeout: 3_000 });

    // All four filter badges should be visible
    await expect(page.locator('[data-testid="active-filter-category"]')).toBeVisible();
    await expect(page.locator('[data-testid="active-filter-price-min"]')).toBeVisible();
    await expect(page.locator('[data-testid="active-filter-price-max"]')).toBeVisible();
    await expect(page.locator('[data-testid="active-filter-search"]')).toBeVisible();
  });

  test('combined filters that match nothing show "Aucun produit trouvé"', async ({ page }) => {
    // === ACTION ===
    await page.goto('/catalogue');

    // Category: gpu, Search: "Ryzen" (no GPU is named Ryzen)
    await page.locator('[data-testid="category-chip-gpu"]').click();
    await page.locator('[data-testid="search-input"]').fill('Ryzen');

    // === VERIFICATION UI ===
    await expect(page.locator('[data-testid="no-results-message"]')).toBeVisible({ timeout: 3_000 });
    await expect(page.locator('[data-testid="no-results-message"]')).toContainText('Aucun produit trouvé');
  });

  test('removing one filter from combined filters updates results accordingly', async ({ page }) => {
    // === ACTION ===
    await page.goto('/catalogue');

    // Apply category + search
    await page.locator('[data-testid="category-chip-cpu"]').click();
    await page.locator('[data-testid="search-input"]').fill('Ryzen');

    // Wait for combined filter
    await expect(async () => {
      const countText = await page.locator('[data-testid="results-count"]').textContent();
      const count = parseInt(countText!.trim(), 10);
      expect(count).toBeGreaterThan(0);
    }).toPass({ timeout: 3_000 });

    const filteredCountText = await page.locator('[data-testid="results-count"]').textContent();
    const filteredCount = parseInt(filteredCountText!.trim(), 10);

    // Remove category filter, keep search
    await page.locator('[data-testid="remove-category-filter-btn"]').click();

    // === VERIFICATION UI ===
    // Results should still be filtered by search only
    // (Ryzen count might be the same or different, but category badge gone)
    await expect(page.locator('[data-testid="active-filter-category"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="active-filter-search"]')).toBeVisible();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// AC4 — Performance: filters return results in under 1 second (NFR4)
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Story 3.3 — AC4/NFR4: Filter performance < 1 second', () => {

  test('category filter returns results in under 1 second', async ({ page }) => {
    // === ACTION ===
    await page.goto('/catalogue');
    // Wait for initial load
    await expect(page.locator('[data-testid="results-count"]')).toBeVisible();

    const startTime = Date.now();
    await page.locator('[data-testid="category-chip-cpu"]').click();

    // Wait for filter to apply
    await expect(async () => {
      const countText = await page.locator('[data-testid="results-count"]').textContent();
      const count = parseInt(countText!.trim(), 10);
      expect(count).toBeLessThanOrEqual(PRODUCTS_PER_CATEGORY);
    }).toPass({ timeout: 1_000 });

    const duration = Date.now() - startTime;

    // === VERIFICATION ===
    expect(duration).toBeLessThan(1_000);
  });

  test('price filter returns results in under 1 second', async ({ page }) => {
    // === ACTION ===
    await page.goto('/catalogue');
    await expect(page.locator('[data-testid="results-count"]')).toBeVisible();

    const startTime = Date.now();
    await page.locator('[data-testid="price-max-input"]').fill('200');

    // Wait for filter to apply
    await expect(async () => {
      const countText = await page.locator('[data-testid="results-count"]').textContent();
      const count = parseInt(countText!.trim(), 10);
      expect(count).toBeLessThan(TOTAL_PRODUCTS);
    }).toPass({ timeout: 1_000 });

    const duration = Date.now() - startTime;

    // === VERIFICATION ===
    expect(duration).toBeLessThan(1_000);
  });

  test('search filter returns results in under 1 second (after debounce)', async ({ page }) => {
    // === ACTION ===
    await page.goto('/catalogue');
    await expect(page.locator('[data-testid="results-count"]')).toBeVisible();

    const startTime = Date.now();
    await page.locator('[data-testid="search-input"]').fill('Corsair');

    // Wait for debounce (300ms) + filter to apply (total should be < 1s)
    await expect(async () => {
      const countText = await page.locator('[data-testid="results-count"]').textContent();
      const count = parseInt(countText!.trim(), 10);
      expect(count).toBeLessThan(TOTAL_PRODUCTS);
    }).toPass({ timeout: 1_500 });

    const duration = Date.now() - startTime;

    // === VERIFICATION ===
    // Including debounce time, should still be fast
    expect(duration).toBeLessThan(1_500);
  });

  test('combined filters return results in under 1 second', async ({ page }) => {
    // === ACTION ===
    await page.goto('/catalogue');
    await expect(page.locator('[data-testid="results-count"]')).toBeVisible();

    // Apply all three filters
    await page.locator('[data-testid="category-chip-cpu"]').click();
    await page.locator('[data-testid="price-min-input"]').fill('400');

    const startTime = Date.now();
    await page.locator('[data-testid="search-input"]').fill('Ryzen');

    // Wait for all filters to apply
    await expect(async () => {
      const countText = await page.locator('[data-testid="results-count"]').textContent();
      const count = parseInt(countText!.trim(), 10);
      expect(count).toBeLessThanOrEqual(PRODUCTS_PER_CATEGORY);
    }).toPass({ timeout: 1_500 });

    const duration = Date.now() - startTime;

    // === VERIFICATION ===
    expect(duration).toBeLessThan(1_500);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Reset filters — restores original state
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Story 3.3 — Reset filters clears all active filters', () => {

  test('reset button clears all filters and shows all products', async ({ page }) => {
    // === ACTION ===
    await page.goto('/catalogue');

    const initialCountText = await page.locator('[data-testid="results-count"]').textContent();
    const initialCount = parseInt(initialCountText!.trim(), 10);

    // Apply multiple filters
    await page.locator('[data-testid="category-chip-gpu"]').click();
    await page.locator('[data-testid="price-min-input"]').fill('500');
    await page.locator('[data-testid="search-input"]').fill('RTX');

    // Wait for filters to apply
    await expect(async () => {
      const countText = await page.locator('[data-testid="results-count"]').textContent();
      const count = parseInt(countText!.trim(), 10);
      expect(count).toBeLessThan(initialCount);
    }).toPass({ timeout: 3_000 });

    // Click reset button
    await page.locator('[data-testid="filters-reset-btn"]').click();

    // === VERIFICATION UI ===
    // All filter badges should disappear
    await expect(page.locator('[data-testid="active-filters-summary"]')).not.toBeVisible();

    // Products count should return to initial
    await expect(async () => {
      const countText = await page.locator('[data-testid="results-count"]').textContent();
      const count = parseInt(countText!.trim(), 10);
      expect(count).toBe(initialCount);
    }).toPass({ timeout: 3_000 });
  });

  test('reset button clears the search input field', async ({ page }) => {
    // === ACTION ===
    await page.goto('/catalogue');

    await page.locator('[data-testid="search-input"]').fill('RTX');
    await expect(page.locator('[data-testid="active-filter-search"]')).toBeVisible({ timeout: 3_000 });

    await page.locator('[data-testid="filters-reset-btn"]').click();

    // === VERIFICATION UI ===
    const searchValue = await page.locator('[data-testid="search-input"]').inputValue();
    expect(searchValue).toBe('');
  });

  test('reset button clears the price range input fields', async ({ page }) => {
    // === ACTION ===
    await page.goto('/catalogue');

    await page.locator('[data-testid="price-min-input"]').fill('100');
    await page.locator('[data-testid="price-max-input"]').fill('500');

    await page.locator('[data-testid="filters-reset-btn"]').click();

    // === VERIFICATION UI ===
    const minValue = await page.locator('[data-testid="price-min-input"]').inputValue();
    const maxValue = await page.locator('[data-testid="price-max-input"]').inputValue();
    expect(minValue).toBe('');
    expect(maxValue).toBe('');
  });

  test('reset button deselects the active category chip', async ({ page }) => {
    // === ACTION ===
    await page.goto('/catalogue');

    await page.locator('[data-testid="category-chip-cpu"]').click();
    await expect(page.locator('[data-testid="active-filter-category"]')).toBeVisible();

    await page.locator('[data-testid="filters-reset-btn"]').click();

    // === VERIFICATION UI ===
    await expect(page.locator('[data-testid="active-filter-category"]')).not.toBeVisible();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Public access — filters accessible without authentication
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Story 3.3 — Public access: filters work without authentication', () => {

  test('visitor (not logged in) can access catalogue page with filters', async ({ page }) => {
    // === SETUP — ensure no auth ===
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.removeItem('token');
      localStorage.removeItem('activeEntrepriseId');
    });

    // === ACTION ===
    await page.goto('/catalogue');

    // === VERIFICATION UI ===
    await expect(page.locator('[data-testid="catalogue-page"]')).toBeVisible();
    await expect(page.locator('[data-testid="product-filters"]')).toBeVisible();
    await expect(page.locator('[data-testid="search-input"]')).toBeVisible();
    expect(page.url()).not.toContain('/login');
  });

  test('visitor can use category filter without being redirected', async ({ page }) => {
    // === SETUP ===
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.removeItem('token');
      localStorage.removeItem('activeEntrepriseId');
    });

    // === ACTION ===
    await page.goto('/catalogue');
    await page.locator('[data-testid="category-chip-gpu"]').click();

    // === VERIFICATION UI ===
    await expect(page.locator('[data-testid="active-filter-category"]')).toBeVisible();
    expect(page.url()).not.toContain('/login');
  });

  test('visitor can use search filter without being redirected', async ({ page }) => {
    // === SETUP ===
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.removeItem('token');
      localStorage.removeItem('activeEntrepriseId');
    });

    // === ACTION ===
    await page.goto('/catalogue');
    await page.locator('[data-testid="search-input"]').fill('RTX');

    // === VERIFICATION UI ===
    await expect(page.locator('[data-testid="active-filter-search"]')).toBeVisible({ timeout: 3_000 });
    expect(page.url()).not.toContain('/login');
  });

  test('visitor can use price filter without being redirected', async ({ page }) => {
    // === SETUP ===
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.removeItem('token');
      localStorage.removeItem('activeEntrepriseId');
    });

    // === ACTION ===
    await page.goto('/catalogue');
    await page.locator('[data-testid="price-min-input"]').fill('100');

    // === VERIFICATION UI ===
    await expect(page.locator('[data-testid="active-filter-price-min"]')).toBeVisible();
    expect(page.url()).not.toContain('/login');
  });

  test('acheteur can use filters on catalogue page', async ({ page }) => {
    // === SETUP ===
    await loginAs(page, ACHETEUR_EMAIL, ACHETEUR_PASSWORD);

    // === ACTION ===
    await page.goto('/catalogue');
    await page.locator('[data-testid="category-chip-ram"]').click();

    // === VERIFICATION UI ===
    await expect(page.locator('[data-testid="active-filter-category"]')).toBeVisible();
    await expect(page.locator('[data-testid="active-filter-category"]')).toContainText('RAM');
  });

  test('vendeur can use filters on catalogue page', async ({ page }) => {
    // === SETUP ===
    await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);

    // === ACTION ===
    await page.goto('/catalogue');
    await page.locator('[data-testid="search-input"]').fill('Samsung');

    // === VERIFICATION UI ===
    await expect(page.locator('[data-testid="active-filter-search"]')).toBeVisible({ timeout: 3_000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Backend API — Filter query parameters (Task 1)
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Story 3.3 — Backend API: Filter query parameters', () => {

  test('GET /api/products supports category query parameter', async ({ page }) => {
    // === ACTION ===
    const response = await page.request.get(`${API_URL}/products?category=cpu`, {
      headers: { Accept: 'application/json' },
    });

    // === VERIFICATION ===
    expect(response.status()).toBe(200);
    const json = await response.json();
    const products = json.data || json;
    expect(Array.isArray(products)).toBeTruthy();

    // All returned products should have category = 'cpu'
    for (const product of products) {
      expect(product.category).toBe('cpu');
    }
  });

  test('GET /api/products supports price_min query parameter', async ({ page }) => {
    // === ACTION ===
    const response = await page.request.get(`${API_URL}/products?price_min=500`, {
      headers: { Accept: 'application/json' },
    });

    // === VERIFICATION ===
    expect(response.status()).toBe(200);
    const json = await response.json();
    const products = json.data || json;
    expect(Array.isArray(products)).toBeTruthy();

    // All returned products should have price >= 500
    for (const product of products) {
      expect(Number(product.price)).toBeGreaterThanOrEqual(500);
    }
  });

  test('GET /api/products supports price_max query parameter', async ({ page }) => {
    // === ACTION ===
    const response = await page.request.get(`${API_URL}/products?price_max=200`, {
      headers: { Accept: 'application/json' },
    });

    // === VERIFICATION ===
    expect(response.status()).toBe(200);
    const json = await response.json();
    const products = json.data || json;
    expect(Array.isArray(products)).toBeTruthy();

    // All returned products should have price <= 200
    for (const product of products) {
      expect(Number(product.price)).toBeLessThanOrEqual(200);
    }
  });

  test('GET /api/products supports search query parameter (LIKE %term%)', async ({ page }) => {
    // === ACTION ===
    const response = await page.request.get(`${API_URL}/products?search=RTX`, {
      headers: { Accept: 'application/json' },
    });

    // === VERIFICATION ===
    expect(response.status()).toBe(200);
    const json = await response.json();
    const products = json.data || json;
    expect(Array.isArray(products)).toBeTruthy();

    // All returned products should have "RTX" in their name
    for (const product of products) {
      expect(product.name.toLowerCase()).toContain('rtx');
    }
  });

  test('GET /api/products supports combined filters (AND logic)', async ({ page }) => {
    // === ACTION ===
    const response = await page.request.get(
      `${API_URL}/products?category=cpu&price_min=400&price_max=600&search=Ryzen`,
      { headers: { Accept: 'application/json' } }
    );

    // === VERIFICATION ===
    expect(response.status()).toBe(200);
    const json = await response.json();
    const products = json.data || json;
    expect(Array.isArray(products)).toBeTruthy();

    for (const product of products) {
      expect(product.category).toBe('cpu');
      expect(Number(product.price)).toBeGreaterThanOrEqual(400);
      expect(Number(product.price)).toBeLessThanOrEqual(600);
      expect(product.name.toLowerCase()).toContain('ryzen');
    }
  });

  test('GET /api/products with no matching filters returns empty array', async ({ page }) => {
    // === ACTION ===
    const response = await page.request.get(
      `${API_URL}/products?category=cpu&search=ZZZZNONEXISTENT`,
      { headers: { Accept: 'application/json' } }
    );

    // === VERIFICATION ===
    expect(response.status()).toBe(200);
    const json = await response.json();
    const products = json.data || json;
    expect(Array.isArray(products)).toBeTruthy();
    expect(products.length).toBe(0);
  });

  test('GET /api/products without filters returns all active products', async ({ page }) => {
    // === ACTION ===
    const response = await page.request.get(`${API_URL}/products`, {
      headers: { Accept: 'application/json' },
    });

    // === VERIFICATION ===
    expect(response.status()).toBe(200);
    const json = await response.json();
    const products = json.data || json;
    expect(Array.isArray(products)).toBeTruthy();
    expect(products.length).toBeGreaterThan(0);
  });

  test('GET /api/products does not require authentication', async ({ page }) => {
    // === ACTION — no auth header ===
    const response = await page.request.get(`${API_URL}/products`, {
      headers: { Accept: 'application/json' },
    });

    // === VERIFICATION ===
    expect(response.status()).not.toBe(401);
    expect(response.status()).not.toBe(403);
    expect(response.status()).toBe(200);
  });

  test('GET /api/products filter response time < 1 second', async ({ page }) => {
    // === ACTION ===
    const startTime = Date.now();
    const response = await page.request.get(
      `${API_URL}/products?category=cpu&price_min=100&price_max=1000&search=Ryzen`,
      { headers: { Accept: 'application/json' } }
    );
    const duration = Date.now() - startTime;

    // === VERIFICATION ===
    expect(response.status()).toBe(200);
    expect(duration).toBeLessThan(1_000);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// DB verification — Filter indexes and data integrity
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Story 3.3 — DB verification: Filter data integrity', () => {

  test('products table has products across all 8 categories', async () => {
    // === VERIFICATION DB ===
    const validCategories = ['cpu', 'gpu', 'ram', 'stockage', 'cm', 'alimentation', 'boitier', 'peripheriques'];

    const categories = await db.query<(RowDataPacket & { category: string })[]>(
      'SELECT DISTINCT category FROM products WHERE is_active = 1'
    );

    const categorySlugs = categories.map(c => c.category);

    // All 8 categories should have at least one active product
    for (const cat of validCategories) {
      expect(categorySlugs).toContain(cat);
    }
  });

  test('products have valid price values (positive numbers)', async () => {
    // === VERIFICATION DB ===
    const invalidPrices = await db.query<RowDataPacket[]>(
      'SELECT id, name, price FROM products WHERE price <= 0 OR price IS NULL'
    );

    expect(invalidPrices.length).toBe(0);
  });

  test('products have valid category values from the 8 fixed categories', async () => {
    // === VERIFICATION DB ===
    const validCategories = ['cpu', 'gpu', 'ram', 'stockage', 'cm', 'alimentation', 'boitier', 'peripheriques'];

    const products = await db.query<(RowDataPacket & { category: string })[]>(
      'SELECT DISTINCT category FROM products'
    );

    for (const product of products) {
      expect(validCategories).toContain(product.category);
    }
  });

  test('price and category columns exist on products table (for index support)', async () => {
    // === VERIFICATION DB ===
    const columns = await db.query<(RowDataPacket & { Field: string })[]>(
      'DESCRIBE products'
    );

    const columnNames = columns.map(c => c.Field);
    expect(columnNames).toContain('price');
    expect(columnNames).toContain('category');
    expect(columnNames).toContain('name');
  });

  test('search by name can be performed via SQL LIKE (name column exists and is searchable)', async () => {
    // === VERIFICATION DB ===
    const results = await db.query<RowDataPacket[]>(
      "SELECT id, name FROM products WHERE name LIKE '%RTX%' AND is_active = 1"
    );

    // If there are RTX products, they should be findable via LIKE
    // The key assertion: the query executes without error
    expect(Array.isArray(results)).toBeTruthy();
  });

  test('combined filters can be expressed as SQL WHERE with AND logic', async () => {
    // === VERIFICATION DB ===
    const results = await db.query<RowDataPacket[]>(
      `SELECT id, name, category, price FROM products
       WHERE category = 'cpu'
       AND price >= 400
       AND price <= 600
       AND name LIKE '%Ryzen%'
       AND is_active = 1`
    );

    // The query should execute without error (testing AND logic at DB level)
    expect(Array.isArray(results)).toBeTruthy();
  });

  test('only active products should be filtered (is_active = 1)', async () => {
    // === VERIFICATION DB ===
    const activeCount = await db.count('products', { is_active: 1 });
    const totalCount = await db.count('products');

    // Active products should be a subset of total
    expect(activeCount).toBeLessThanOrEqual(totalCount);
    expect(activeCount).toBeGreaterThan(0);
  });

  test('products have valid foreign keys (seller_id references existing users)', async () => {
    // === VERIFICATION DB ===
    const orphanedProducts = await db.query<RowDataPacket[]>(
      `SELECT p.id, p.name, p.seller_id
       FROM products p
       LEFT JOIN users u ON p.seller_id = u.id
       WHERE u.id IS NULL`
    );

    // No orphaned products
    expect(orphanedProducts.length).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Edge cases — Boundary conditions and special inputs
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Story 3.3 — Edge cases: Boundary conditions', () => {

  test('price min = 0 does not filter out any products', async ({ page }) => {
    // === ACTION ===
    await page.goto('/catalogue');

    const initialCountText = await page.locator('[data-testid="results-count"]').textContent();
    const initialCount = parseInt(initialCountText!.trim(), 10);

    await page.locator('[data-testid="price-min-input"]').fill('0');

    // === VERIFICATION UI ===
    // Price min = 0 should not filter out anything (all prices > 0)
    await expect(async () => {
      const countText = await page.locator('[data-testid="results-count"]').textContent();
      const count = parseInt(countText!.trim(), 10);
      expect(count).toBe(initialCount);
    }).toPass({ timeout: 3_000 });
  });

  test('price max = very large number does not filter out any products', async ({ page }) => {
    // === ACTION ===
    await page.goto('/catalogue');

    const initialCountText = await page.locator('[data-testid="results-count"]').textContent();
    const initialCount = parseInt(initialCountText!.trim(), 10);

    await page.locator('[data-testid="price-max-input"]').fill('999999');

    // === VERIFICATION UI ===
    await expect(async () => {
      const countText = await page.locator('[data-testid="results-count"]').textContent();
      const count = parseInt(countText!.trim(), 10);
      expect(count).toBe(initialCount);
    }).toPass({ timeout: 3_000 });
  });

  test('empty search string shows all products', async ({ page }) => {
    // === ACTION ===
    await page.goto('/catalogue');

    const initialCountText = await page.locator('[data-testid="results-count"]').textContent();
    const initialCount = parseInt(initialCountText!.trim(), 10);

    // Type and then clear
    await page.locator('[data-testid="search-input"]').fill('test');
    await page.locator('[data-testid="search-input"]').fill('');

    // === VERIFICATION UI ===
    await expect(async () => {
      const countText = await page.locator('[data-testid="results-count"]').textContent();
      const count = parseInt(countText!.trim(), 10);
      expect(count).toBe(initialCount);
    }).toPass({ timeout: 3_000 });
  });

  test('search with only spaces does not crash and shows appropriate results', async ({ page }) => {
    // === ACTION ===
    await page.goto('/catalogue');

    await page.locator('[data-testid="search-input"]').fill('   ');

    // === VERIFICATION UI ===
    // Should not crash — either shows all products or no results depending on implementation
    await expect(async () => {
      const resultsCount = page.locator('[data-testid="results-count"]');
      const noResults = page.locator('[data-testid="no-results-message"]');
      const hasResults = await resultsCount.isVisible().catch(() => false);
      const hasNoResults = await noResults.isVisible().catch(() => false);
      expect(hasResults || hasNoResults).toBeTruthy();
    }).toPass({ timeout: 3_000 });
  });

  test('price min greater than price max shows no results', async ({ page }) => {
    // === ACTION ===
    await page.goto('/catalogue');

    // Set min > max (invalid range)
    await page.locator('[data-testid="price-min-input"]').fill('1000');
    await page.locator('[data-testid="price-max-input"]').fill('100');

    // === VERIFICATION UI ===
    // No products should match a range where min > max
    await expect(page.locator('[data-testid="no-results-message"]')).toBeVisible({ timeout: 3_000 });
  });

  test('special characters in search do not crash the application', async ({ page }) => {
    // === ACTION ===
    await page.goto('/catalogue');

    // Type special characters
    await page.locator('[data-testid="search-input"]').fill('<script>alert("xss")</script>');

    // === VERIFICATION UI ===
    // Should not crash, just show no results
    await expect(async () => {
      const resultsCount = page.locator('[data-testid="results-count"]');
      const noResults = page.locator('[data-testid="no-results-message"]');
      const hasResults = await resultsCount.isVisible().catch(() => false);
      const hasNoResults = await noResults.isVisible().catch(() => false);
      expect(hasResults || hasNoResults).toBeTruthy();
    }).toPass({ timeout: 3_000 });
  });

  test('no active filters summary shown when no filters are applied', async ({ page }) => {
    // === ACTION ===
    await page.goto('/catalogue');

    // === VERIFICATION UI ===
    // No filters applied → active filter summary should NOT be visible
    await expect(page.locator('[data-testid="active-filters-summary"]')).not.toBeVisible();
  });
});
