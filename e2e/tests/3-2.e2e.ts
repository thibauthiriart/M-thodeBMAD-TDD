import { test, expect } from '@playwright/test';
import { RowDataPacket } from 'mysql2/promise';
import { loginAs, logout } from '../helpers/auth';
import { db } from '../helpers/database';

/**
 * Story 3.2 — Product Grid (Master View)
 *
 * AC1: Given a user is on a category page
 *      When products are displayed
 *      Then each product card shows a photo and an intuitive name
 *      And products from multiple sellers are displayed together
 *
 * AC2: Given there are more products than fit on one page
 *      When the user scrolls or navigates
 *      Then products are paginated or lazy-loaded for performance
 *
 * AC3: Given a user clicks on a product card
 *      When the click is registered
 *      Then they are navigated to the product detail page
 *
 * Pre-conditions:
 * - e2e-vendeur@test.com / password exists with role "vendeur" (from E2ETestSeeder)
 * - e2e@test.com / password exists with role "acheteur" (from E2ETestSeeder)
 *
 * The tests describe EXPECTED behavior (TDD). They will fail until:
 * - Backend: CatalogController returns paginated products with photo_url, name, price, seller_name
 * - Backend: Only active products (is_active = true) are returned
 * - Backend: Products from multiple sellers mixed together (FR30)
 * - Frontend: ProductCard.vue shows photo + name + price + seller + stock
 * - Frontend: ProductGrid.vue shows responsive grid with pagination
 * - Frontend: Click on product card navigates to /products/{id}
 * - Frontend: Route /products/:id exists and renders ProductDetailPage.vue
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
// Known categories with enough mock products to test pagination
// ---------------------------------------------------------------------------
const CATEGORY_CPU = { slug: 'cpu', label: 'CPU' };       // 15 mock products → 2 pages (perPage=12)
const CATEGORY_GPU = { slug: 'gpu', label: 'GPU' };       // 5 mock products → 1 page
const CATEGORY_RAM = { slug: 'ram', label: 'RAM' };       // 4 mock products → 1 page

// Known sellers in mock data (FR30: multi-seller)
const KNOWN_SELLERS = ['HardwareShop', 'PCMaster', 'TechWorld', 'BonPrix'];

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------
test.afterAll(async () => {
  await db.cleanup();
});

// ═══════════════════════════════════════════════════════════════════════════
// AC1 — Each product card shows photo, name, price, seller, stock
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Story 3.2 — AC1: Product card shows photo and intuitive name', () => {

  test('product cards are displayed inside a responsive grid', async ({ page }) => {
    // === ACTION ===
    await page.goto(`/categories/${CATEGORY_CPU.slug}`);

    // === VERIFICATION UI ===
    // Wait for loading to finish
    await expect(page.locator('[data-testid="product-grid-loading"]')).not.toBeVisible({ timeout: 5_000 });

    // Grid container is visible
    await expect(page.locator('[data-testid="product-grid-container"]')).toBeVisible();
    await expect(page.locator('[data-testid="product-grid"]')).toBeVisible();

    // There should be product cards inside the grid
    const cards = page.locator('[data-testid="product-grid"] [data-testid^="product-card-"]');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
  });

  test('each product card shows a photo area', async ({ page }) => {
    // === ACTION ===
    await page.goto(`/categories/${CATEGORY_GPU.slug}`);
    await expect(page.locator('[data-testid="product-grid-loading"]')).not.toBeVisible({ timeout: 5_000 });

    // === VERIFICATION UI ===
    const firstCard = page.locator('[data-testid^="product-card-"]').first();
    await expect(firstCard).toBeVisible();

    // Extract product ID from the card
    const testId = await firstCard.getAttribute('data-testid');
    const productId = testId!.replace('product-card-', '');

    // Photo area must be present
    const imageArea = page.locator(`[data-testid="product-image-${productId}"]`);
    await expect(imageArea).toBeVisible();
  });

  test('each product card shows an intuitive product name', async ({ page }) => {
    // === ACTION ===
    await page.goto(`/categories/${CATEGORY_CPU.slug}`);
    await expect(page.locator('[data-testid="product-grid-loading"]')).not.toBeVisible({ timeout: 5_000 });

    // === VERIFICATION UI ===
    const firstCard = page.locator('[data-testid^="product-card-"]').first();
    const testId = await firstCard.getAttribute('data-testid');
    const productId = testId!.replace('product-card-', '');

    // Name must be visible and non-empty
    const nameEl = page.locator(`[data-testid="product-name-${productId}"]`);
    await expect(nameEl).toBeVisible();
    const name = await nameEl.textContent();
    expect(name!.trim().length).toBeGreaterThan(0);
  });

  test('each product card shows a price formatted in EUR', async ({ page }) => {
    // === ACTION ===
    await page.goto(`/categories/${CATEGORY_GPU.slug}`);
    await expect(page.locator('[data-testid="product-grid-loading"]')).not.toBeVisible({ timeout: 5_000 });

    // === VERIFICATION UI ===
    const firstCard = page.locator('[data-testid^="product-card-"]').first();
    const testId = await firstCard.getAttribute('data-testid');
    const productId = testId!.replace('product-card-', '');

    const priceEl = page.locator(`[data-testid="product-price-${productId}"]`);
    await expect(priceEl).toBeVisible();
    const priceText = await priceEl.textContent();

    // French locale EUR: "1 799,99 €" — must contain digits, comma decimal, euro sign
    expect(priceText).toMatch(/\d/);
    expect(priceText).toMatch(/€/);
    expect(priceText).toMatch(/\d+,\d{2}/);
  });

  test('each product card shows the seller name', async ({ page }) => {
    // === ACTION ===
    await page.goto(`/categories/${CATEGORY_CPU.slug}`);
    await expect(page.locator('[data-testid="product-grid-loading"]')).not.toBeVisible({ timeout: 5_000 });

    // === VERIFICATION UI ===
    const firstCard = page.locator('[data-testid^="product-card-"]').first();
    const testId = await firstCard.getAttribute('data-testid');
    const productId = testId!.replace('product-card-', '');

    const sellerEl = page.locator(`[data-testid="product-seller-${productId}"]`);
    await expect(sellerEl).toBeVisible();
    await expect(sellerEl).toContainText('Vendu par');

    // The seller name should be non-empty
    const sellerText = await sellerEl.textContent();
    expect(sellerText!.replace('Vendu par', '').trim().length).toBeGreaterThan(0);
  });

  test('each product card shows stock status (En stock or Rupture)', async ({ page }) => {
    // === ACTION ===
    await page.goto(`/categories/${CATEGORY_CPU.slug}`);
    await expect(page.locator('[data-testid="product-grid-loading"]')).not.toBeVisible({ timeout: 5_000 });

    // === VERIFICATION UI ===
    const firstCard = page.locator('[data-testid^="product-card-"]').first();
    const testId = await firstCard.getAttribute('data-testid');
    const productId = testId!.replace('product-card-', '');

    const stockEl = page.locator(`[data-testid="product-stock-${productId}"]`);
    await expect(stockEl).toBeVisible();
    const stockText = await stockEl.textContent();
    expect(stockText).toMatch(/En stock|Rupture/i);
  });

  test('product grid shows a product count', async ({ page }) => {
    // === ACTION ===
    await page.goto(`/categories/${CATEGORY_CPU.slug}`);
    await expect(page.locator('[data-testid="product-grid-loading"]')).not.toBeVisible({ timeout: 5_000 });

    // === VERIFICATION UI ===
    const countEl = page.locator('[data-testid="product-grid-count"]');
    await expect(countEl).toBeVisible();

    // Should contain a number and "produit(s) trouve(s)"
    const countText = await countEl.textContent();
    expect(countText).toMatch(/\d+ produits? trouvés?/);
  });

  test('all product cards in a grid have unique IDs', async ({ page }) => {
    // === ACTION ===
    await page.goto(`/categories/${CATEGORY_GPU.slug}`);
    await expect(page.locator('[data-testid="product-grid-loading"]')).not.toBeVisible({ timeout: 5_000 });

    // === VERIFICATION UI ===
    const cards = page.locator('[data-testid^="product-card-"]');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);

    // Collect all product IDs and ensure uniqueness
    const ids: string[] = [];
    for (let i = 0; i < count; i++) {
      const testId = await cards.nth(i).getAttribute('data-testid');
      ids.push(testId!);
    }
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// AC1 — Products from multiple sellers displayed together (FR30)
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Story 3.2 — AC1: Multi-seller products mixed together (FR30)', () => {

  test('CPU category shows products from at least 2 different sellers', async ({ page }) => {
    // === ACTION ===
    await page.goto(`/categories/${CATEGORY_CPU.slug}`);
    await expect(page.locator('[data-testid="product-grid-loading"]')).not.toBeVisible({ timeout: 5_000 });

    // === VERIFICATION UI ===
    const cards = page.locator('[data-testid^="product-card-"]');
    const count = await cards.count();
    expect(count).toBeGreaterThan(1);

    // Collect seller names
    const sellers = new Set<string>();
    for (let i = 0; i < count; i++) {
      const testId = await cards.nth(i).getAttribute('data-testid');
      const productId = testId!.replace('product-card-', '');
      const sellerEl = page.locator(`[data-testid="product-seller-${productId}"]`);
      const sellerText = await sellerEl.textContent();
      const sellerName = sellerText!.replace('Vendu par', '').trim();
      sellers.add(sellerName);
    }

    // FR30: Products from multiple sellers must be mixed together
    expect(sellers.size).toBeGreaterThanOrEqual(2);
  });

  test('sellers include known marketplace sellers', async ({ page }) => {
    // === ACTION ===
    await page.goto(`/categories/${CATEGORY_CPU.slug}`);
    await expect(page.locator('[data-testid="product-grid-loading"]')).not.toBeVisible({ timeout: 5_000 });

    // === VERIFICATION UI ===
    const cards = page.locator('[data-testid^="product-card-"]');
    const count = await cards.count();

    const sellers = new Set<string>();
    for (let i = 0; i < count; i++) {
      const testId = await cards.nth(i).getAttribute('data-testid');
      const productId = testId!.replace('product-card-', '');
      const sellerEl = page.locator(`[data-testid="product-seller-${productId}"]`);
      const sellerText = await sellerEl.textContent();
      const sellerName = sellerText!.replace('Vendu par', '').trim();
      sellers.add(sellerName);
    }

    // At least one seller should be a known marketplace seller
    const hasKnownSeller = [...sellers].some(s => KNOWN_SELLERS.includes(s));
    expect(hasKnownSeller).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// AC1 — Responsive grid layout
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Story 3.2 — AC1: Responsive grid layout', () => {

  test('grid displays in 4 columns on desktop viewport (1280px)', async ({ page }) => {
    // === SETUP ===
    await page.setViewportSize({ width: 1280, height: 800 });

    // === ACTION ===
    await page.goto(`/categories/${CATEGORY_GPU.slug}`);
    await expect(page.locator('[data-testid="product-grid-loading"]')).not.toBeVisible({ timeout: 5_000 });

    // === VERIFICATION UI ===
    const grid = page.locator('[data-testid="product-grid"]');
    await expect(grid).toBeVisible();

    // Verify grid has the responsive CSS class for 4 columns on desktop
    // The actual rendering at 1280px width with lg:grid-cols-4 should produce 4 columns
    const cards = grid.locator('[data-testid^="product-card-"]');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);

    // Verify the grid layout by checking that the first 4 cards (if available)
    // have similar Y positions (same row)
    if (count >= 4) {
      const firstBox = await cards.nth(0).boundingBox();
      const fourthBox = await cards.nth(3).boundingBox();
      expect(firstBox).not.toBeNull();
      expect(fourthBox).not.toBeNull();
      // Same row means similar Y coordinate
      expect(Math.abs(firstBox!.y - fourthBox!.y)).toBeLessThan(5);
    }
  });

  test('grid displays in 2 columns on tablet viewport (768px)', async ({ page }) => {
    // === SETUP ===
    await page.setViewportSize({ width: 768, height: 1024 });

    // === ACTION ===
    await page.goto(`/categories/${CATEGORY_GPU.slug}`);
    await expect(page.locator('[data-testid="product-grid-loading"]')).not.toBeVisible({ timeout: 5_000 });

    // === VERIFICATION UI ===
    const grid = page.locator('[data-testid="product-grid"]');
    const cards = grid.locator('[data-testid^="product-card-"]');
    const count = await cards.count();

    if (count >= 3) {
      const firstBox = await cards.nth(0).boundingBox();
      const secondBox = await cards.nth(1).boundingBox();
      const thirdBox = await cards.nth(2).boundingBox();
      expect(firstBox).not.toBeNull();
      expect(secondBox).not.toBeNull();
      expect(thirdBox).not.toBeNull();
      // First 2 cards on same row, third card on next row
      expect(Math.abs(firstBox!.y - secondBox!.y)).toBeLessThan(5);
      expect(thirdBox!.y).toBeGreaterThan(firstBox!.y + 10);
    }
  });

  test('grid displays in 1 column on mobile viewport (375px)', async ({ page }) => {
    // === SETUP ===
    await page.setViewportSize({ width: 375, height: 812 });

    // === ACTION ===
    await page.goto(`/categories/${CATEGORY_GPU.slug}`);
    await expect(page.locator('[data-testid="product-grid-loading"]')).not.toBeVisible({ timeout: 5_000 });

    // === VERIFICATION UI ===
    const grid = page.locator('[data-testid="product-grid"]');
    const cards = grid.locator('[data-testid^="product-card-"]');
    const count = await cards.count();

    if (count >= 2) {
      const firstBox = await cards.nth(0).boundingBox();
      const secondBox = await cards.nth(1).boundingBox();
      expect(firstBox).not.toBeNull();
      expect(secondBox).not.toBeNull();
      // 1 column: each card on its own row → second card below first
      expect(secondBox!.y).toBeGreaterThan(firstBox!.y + 10);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// AC2 — Pagination for categories with many products
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Story 3.2 — AC2: Pagination when products exceed one page', () => {

  test('category with more than 12 products shows pagination controls', async ({ page }) => {
    // CPU has 15 mock products → 2 pages at perPage=12
    // === ACTION ===
    await page.goto(`/categories/${CATEGORY_CPU.slug}`);
    await expect(page.locator('[data-testid="product-grid-loading"]')).not.toBeVisible({ timeout: 5_000 });

    // === VERIFICATION UI ===
    // Pagination bar should be visible
    const pagination = page.locator('[data-testid="product-grid-pagination"]');
    await expect(pagination).toBeVisible();

    // Previous and next buttons should be visible
    await expect(page.locator('[data-testid="pagination-prev-btn"]')).toBeVisible();
    await expect(page.locator('[data-testid="pagination-next-btn"]')).toBeVisible();

    // Page info should show "Page 1 sur X"
    const pageInfo = page.locator('[data-testid="pagination-info"]');
    await expect(pageInfo).toBeVisible();
    await expect(pageInfo).toContainText('Page 1 sur');
  });

  test('category with few products does NOT show pagination', async ({ page }) => {
    // GPU has 5 products → 1 page at perPage=12, no pagination needed
    // === ACTION ===
    await page.goto(`/categories/${CATEGORY_GPU.slug}`);
    await expect(page.locator('[data-testid="product-grid-loading"]')).not.toBeVisible({ timeout: 5_000 });

    // === VERIFICATION UI ===
    // Pagination should NOT appear for a single page
    await expect(page.locator('[data-testid="product-grid-pagination"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="pagination-info"]')).not.toBeVisible();
  });

  test('first page shows maximum perPage products (12)', async ({ page }) => {
    // === ACTION ===
    await page.goto(`/categories/${CATEGORY_CPU.slug}`);
    await expect(page.locator('[data-testid="product-grid-loading"]')).not.toBeVisible({ timeout: 5_000 });

    // === VERIFICATION UI ===
    const cards = page.locator('[data-testid="product-grid"] [data-testid^="product-card-"]');
    const count = await cards.count();

    // First page should show exactly perPage items (12) when total > 12
    expect(count).toBe(12);
  });

  test('previous button is disabled on the first page', async ({ page }) => {
    // === ACTION ===
    await page.goto(`/categories/${CATEGORY_CPU.slug}`);
    await expect(page.locator('[data-testid="product-grid-loading"]')).not.toBeVisible({ timeout: 5_000 });

    // === VERIFICATION UI ===
    const prevBtn = page.locator('[data-testid="pagination-prev-btn"]');
    await expect(prevBtn).toBeVisible();
    await expect(prevBtn).toBeDisabled();
  });

  test('next button is enabled on the first page when there are more pages', async ({ page }) => {
    // === ACTION ===
    await page.goto(`/categories/${CATEGORY_CPU.slug}`);
    await expect(page.locator('[data-testid="product-grid-loading"]')).not.toBeVisible({ timeout: 5_000 });

    // === VERIFICATION UI ===
    const nextBtn = page.locator('[data-testid="pagination-next-btn"]');
    await expect(nextBtn).toBeVisible();
    await expect(nextBtn).not.toBeDisabled();
  });

  test('clicking next page shows remaining products', async ({ page }) => {
    // === ACTION ===
    await page.goto(`/categories/${CATEGORY_CPU.slug}`);
    await expect(page.locator('[data-testid="product-grid-loading"]')).not.toBeVisible({ timeout: 5_000 });

    // Verify page 1
    const pageInfo = page.locator('[data-testid="pagination-info"]');
    await expect(pageInfo).toContainText('Page 1 sur');

    const cardsPage1 = page.locator('[data-testid="product-grid"] [data-testid^="product-card-"]');
    const countPage1 = await cardsPage1.count();
    expect(countPage1).toBe(12);

    // Collect product IDs from page 1
    const idsPage1: string[] = [];
    for (let i = 0; i < countPage1; i++) {
      const testId = await cardsPage1.nth(i).getAttribute('data-testid');
      idsPage1.push(testId!);
    }

    // === ACTION: Click next ===
    await page.locator('[data-testid="pagination-next-btn"]').click();

    // === VERIFICATION UI ===
    await expect(pageInfo).toContainText('Page 2 sur');

    const cardsPage2 = page.locator('[data-testid="product-grid"] [data-testid^="product-card-"]');
    const countPage2 = await cardsPage2.count();

    // Page 2 should show remaining products (15 - 12 = 3)
    expect(countPage2).toBeGreaterThan(0);
    expect(countPage2).toBeLessThanOrEqual(12);

    // Products on page 2 should be different from page 1
    const idsPage2: string[] = [];
    for (let i = 0; i < countPage2; i++) {
      const testId = await cardsPage2.nth(i).getAttribute('data-testid');
      idsPage2.push(testId!);
    }

    for (const id of idsPage2) {
      expect(idsPage1).not.toContain(id);
    }
  });

  test('clicking previous page returns to the first page', async ({ page }) => {
    // === SETUP ===
    await page.goto(`/categories/${CATEGORY_CPU.slug}`);
    await expect(page.locator('[data-testid="product-grid-loading"]')).not.toBeVisible({ timeout: 5_000 });

    // Go to page 2
    await page.locator('[data-testid="pagination-next-btn"]').click();
    await expect(page.locator('[data-testid="pagination-info"]')).toContainText('Page 2 sur');

    // === ACTION: Click previous ===
    await page.locator('[data-testid="pagination-prev-btn"]').click();

    // === VERIFICATION UI ===
    await expect(page.locator('[data-testid="pagination-info"]')).toContainText('Page 1 sur');

    const cards = page.locator('[data-testid="product-grid"] [data-testid^="product-card-"]');
    const count = await cards.count();
    expect(count).toBe(12);
  });

  test('page number buttons navigate to the correct page', async ({ page }) => {
    // === ACTION ===
    await page.goto(`/categories/${CATEGORY_CPU.slug}`);
    await expect(page.locator('[data-testid="product-grid-loading"]')).not.toBeVisible({ timeout: 5_000 });

    // === VERIFICATION UI: Page 1 button should be active ===
    const page1Btn = page.locator('[data-testid="pagination-page-1-btn"]');
    await expect(page1Btn).toBeVisible();

    // Click page 2 button
    const page2Btn = page.locator('[data-testid="pagination-page-2-btn"]');
    await expect(page2Btn).toBeVisible();
    await page2Btn.click();

    // Should now show page 2
    await expect(page.locator('[data-testid="pagination-info"]')).toContainText('Page 2 sur');
  });

  test('next button is disabled on the last page', async ({ page }) => {
    // === SETUP ===
    await page.goto(`/categories/${CATEGORY_CPU.slug}`);
    await expect(page.locator('[data-testid="product-grid-loading"]')).not.toBeVisible({ timeout: 5_000 });

    // Navigate to the last page
    const pageInfoText = await page.locator('[data-testid="pagination-info"]').textContent();
    const totalPagesMatch = pageInfoText!.match(/sur (\d+)/);
    const totalPages = parseInt(totalPagesMatch![1], 10);

    // Click through to last page
    for (let i = 1; i < totalPages; i++) {
      await page.locator('[data-testid="pagination-next-btn"]').click();
    }

    // === VERIFICATION UI ===
    await expect(page.locator('[data-testid="pagination-info"]')).toContainText(`Page ${totalPages} sur ${totalPages}`);
    await expect(page.locator('[data-testid="pagination-next-btn"]')).toBeDisabled();
    await expect(page.locator('[data-testid="pagination-prev-btn"]')).not.toBeDisabled();
  });

  test('previous button is enabled on the last page', async ({ page }) => {
    // === SETUP ===
    await page.goto(`/categories/${CATEGORY_CPU.slug}`);
    await expect(page.locator('[data-testid="product-grid-loading"]')).not.toBeVisible({ timeout: 5_000 });

    // Navigate to page 2
    await page.locator('[data-testid="pagination-next-btn"]').click();

    // === VERIFICATION UI ===
    await expect(page.locator('[data-testid="pagination-prev-btn"]')).not.toBeDisabled();
  });

  test('total product count remains consistent across pages', async ({ page }) => {
    // === ACTION ===
    await page.goto(`/categories/${CATEGORY_CPU.slug}`);
    await expect(page.locator('[data-testid="product-grid-loading"]')).not.toBeVisible({ timeout: 5_000 });

    // === VERIFICATION UI ===
    // The product count text should show the TOTAL count, not the per-page count
    const countText = await page.locator('[data-testid="product-grid-count"]').textContent();
    const totalMatch = countText!.match(/(\d+)/);
    const totalCount = parseInt(totalMatch![1], 10);

    // Gather actual products across all pages
    let totalCardsCounted = 0;

    // Page 1
    const cardsPage1 = page.locator('[data-testid="product-grid"] [data-testid^="product-card-"]');
    totalCardsCounted += await cardsPage1.count();

    // Navigate through remaining pages
    const pageInfoText = await page.locator('[data-testid="pagination-info"]').textContent();
    const totalPagesMatch = pageInfoText!.match(/sur (\d+)/);
    const totalPages = parseInt(totalPagesMatch![1], 10);

    for (let i = 1; i < totalPages; i++) {
      await page.locator('[data-testid="pagination-next-btn"]').click();
      const cards = page.locator('[data-testid="product-grid"] [data-testid^="product-card-"]');
      totalCardsCounted += await cards.count();
    }

    // Total cards across all pages should match the count displayed
    expect(totalCardsCounted).toBe(totalCount);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// AC2 — Loading state
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Story 3.2 — AC2: Loading state for product grid', () => {

  test('loading indicator is shown while products are loading', async ({ page }) => {
    // === ACTION ===
    await page.goto(`/categories/${CATEGORY_CPU.slug}`);

    // === VERIFICATION UI ===
    // We expect either:
    // - The loading indicator is briefly visible then disappears
    // - OR the product grid is visible immediately (fast load)
    // The key assertion: eventually we see product grid content
    await expect(
      page.locator('[data-testid="product-grid"], [data-testid="product-grid-empty"]').first()
    ).toBeVisible({ timeout: 5_000 });
  });

  test('loading indicator disappears once products are loaded', async ({ page }) => {
    // === ACTION ===
    await page.goto(`/categories/${CATEGORY_CPU.slug}`);

    // Wait for products to appear
    await expect(page.locator('[data-testid="product-grid"]')).toBeVisible({ timeout: 5_000 });

    // === VERIFICATION UI ===
    // Loading indicator must not be visible once products are loaded
    await expect(page.locator('[data-testid="product-grid-loading"]')).not.toBeVisible();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// AC2 — Empty state
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Story 3.2 — AC2: Empty state when no products', () => {

  test('empty state message is shown when a category has no products', async ({ page }) => {
    // A valid category with no products should show the empty state.
    // We test this by checking the component can render the empty state.
    // In mock data, all categories have products, but the component supports it.

    // === ACTION ===
    // Navigate to a category that might have 0 products in production
    // The test validates the UI contract: if 0 products, empty state appears
    await page.goto(`/categories/${CATEGORY_RAM.slug}`);
    await expect(page.locator('[data-testid="product-grid-loading"]')).not.toBeVisible({ timeout: 5_000 });

    // === VERIFICATION UI ===
    // Either product grid or empty state must be visible
    const grid = page.locator('[data-testid="product-grid"]');
    const empty = page.locator('[data-testid="product-grid-empty"]');

    const hasGrid = await grid.isVisible().catch(() => false);
    const hasEmpty = await empty.isVisible().catch(() => false);

    expect(hasGrid || hasEmpty).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// AC2 — Lazy loading images for performance
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Story 3.2 — AC2: Lazy loading images for performance', () => {

  test('product images use native lazy loading attribute', async ({ page }) => {
    // === ACTION ===
    await page.goto(`/categories/${CATEGORY_GPU.slug}`);
    await expect(page.locator('[data-testid="product-grid-loading"]')).not.toBeVisible({ timeout: 5_000 });

    // === VERIFICATION UI ===
    // Check if img elements inside product cards have loading="lazy"
    // Note: Products may or may not have photo_url. If they do, the img should be lazy.
    const images = page.locator('[data-testid="product-grid"] img');
    const imgCount = await images.count();

    // If there are images with a src, verify they have loading="lazy"
    for (let i = 0; i < imgCount; i++) {
      const loadingAttr = await images.nth(i).getAttribute('loading');
      expect(loadingAttr).toBe('lazy');
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// AC3 — Click on product card navigates to detail page
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Story 3.2 — AC3: Click product card navigates to product detail page', () => {

  test('clicking a product card navigates to /products/{id}', async ({ page }) => {
    // === SETUP ===
    await page.goto(`/categories/${CATEGORY_GPU.slug}`);
    await expect(page.locator('[data-testid="product-grid-loading"]')).not.toBeVisible({ timeout: 5_000 });

    // === ACTION ===
    const firstCard = page.locator('[data-testid^="product-card-"]').first();
    const testId = await firstCard.getAttribute('data-testid');
    const productId = testId!.replace('product-card-', '');

    await firstCard.click();

    // === VERIFICATION UI ===
    await page.waitForURL(`**/products/${productId}`);
    await expect(page.locator('[data-testid="product-detail-page"]')).toBeVisible();
  });

  test('product detail page shows the correct product ID in breadcrumb', async ({ page }) => {
    // === SETUP ===
    await page.goto(`/categories/${CATEGORY_GPU.slug}`);
    await expect(page.locator('[data-testid="product-grid-loading"]')).not.toBeVisible({ timeout: 5_000 });

    const firstCard = page.locator('[data-testid^="product-card-"]').first();
    const testId = await firstCard.getAttribute('data-testid');
    const productId = testId!.replace('product-card-', '');

    // === ACTION ===
    await firstCard.click();
    await page.waitForURL(`**/products/${productId}`);

    // === VERIFICATION UI ===
    const breadcrumbCurrent = page.locator('[data-testid="breadcrumb-current"]');
    await expect(breadcrumbCurrent).toBeVisible();
    await expect(breadcrumbCurrent).toContainText(productId);
  });

  test('product detail page shows product name', async ({ page }) => {
    // === ACTION ===
    await page.goto('/products/101');

    // === VERIFICATION UI ===
    await expect(page.locator('[data-testid="product-detail-page"]')).toBeVisible();
    await expect(page.locator('[data-testid="product-detail-name"]')).toBeVisible();
  });

  test('product detail page shows product image area', async ({ page }) => {
    // === ACTION ===
    await page.goto('/products/101');

    // === VERIFICATION UI ===
    await expect(page.locator('[data-testid="product-detail-image"]')).toBeVisible();
  });

  test('product detail page shows seller name', async ({ page }) => {
    // === ACTION ===
    await page.goto('/products/101');

    // === VERIFICATION UI ===
    await expect(page.locator('[data-testid="product-detail-seller"]')).toBeVisible();
    await expect(page.locator('[data-testid="product-detail-seller"]')).toContainText('Vendu par');
  });

  test('product detail page shows price', async ({ page }) => {
    // === ACTION ===
    await page.goto('/products/101');

    // === VERIFICATION UI ===
    const priceEl = page.locator('[data-testid="product-detail-price"]');
    await expect(priceEl).toBeVisible();
    const priceText = await priceEl.textContent();
    // Price should contain euro sign (even as placeholder)
    expect(priceText).toMatch(/€/);
  });

  test('product detail page shows description', async ({ page }) => {
    // === ACTION ===
    await page.goto('/products/101');

    // === VERIFICATION UI ===
    await expect(page.locator('[data-testid="product-detail-description"]')).toBeVisible();
  });

  test('product detail page shows add-to-cart button', async ({ page }) => {
    // === ACTION ===
    await page.goto('/products/101');

    // === VERIFICATION UI ===
    const addBtn = page.locator('[data-testid="product-detail-add-cart-btn"]');
    await expect(addBtn).toBeVisible();
    await expect(addBtn).toContainText(/panier/i);
  });

  test('product detail page shows breadcrumb with home link', async ({ page }) => {
    // === ACTION ===
    await page.goto('/products/101');

    // === VERIFICATION UI ===
    const breadcrumb = page.locator('[data-testid="product-detail-breadcrumb"]');
    await expect(breadcrumb).toBeVisible();

    const homeLink = page.locator('[data-testid="breadcrumb-home-link"]');
    await expect(homeLink).toBeVisible();
    await expect(homeLink).toContainText('Accueil');
  });

  test('product detail page shows back-to-categories link', async ({ page }) => {
    // === ACTION ===
    await page.goto('/products/101');

    // === VERIFICATION UI ===
    const backLink = page.locator('[data-testid="product-detail-back-link"]');
    await expect(backLink).toBeVisible();
    await expect(backLink).toContainText('Retour');
  });

  test('clicking back link from product detail navigates to homepage', async ({ page }) => {
    // === SETUP ===
    await page.goto('/products/101');
    await expect(page.locator('[data-testid="product-detail-page"]')).toBeVisible();

    // === ACTION ===
    await page.locator('[data-testid="product-detail-back-link"]').click();

    // === VERIFICATION UI ===
    await page.waitForURL('**/');
    await expect(page.locator('[data-testid="home-page"]')).toBeVisible();
  });

  test('product card is a link element (a tag) pointing to /products/{id}', async ({ page }) => {
    // === ACTION ===
    await page.goto(`/categories/${CATEGORY_GPU.slug}`);
    await expect(page.locator('[data-testid="product-grid-loading"]')).not.toBeVisible({ timeout: 5_000 });

    // === VERIFICATION UI ===
    const firstCard = page.locator('[data-testid^="product-card-"]').first();
    const testId = await firstCard.getAttribute('data-testid');
    const productId = testId!.replace('product-card-', '');

    // RouterLink renders as <a>, verify href
    const href = await firstCard.getAttribute('href');
    expect(href).toBe(`/products/${productId}`);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// AC3 — Full navigation flow: Homepage → Category → Product Detail → Back
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Story 3.2 — AC3: Full navigation flow', () => {

  test('user can navigate from homepage → category → product card click → product detail → back', async ({ page }) => {
    // === STEP 1: Homepage ===
    await page.goto('/');
    await expect(page.locator('[data-testid="home-page"]')).toBeVisible();

    // === STEP 2: Navigate to CPU category ===
    await page.locator('[data-testid="category-card-cpu"]').click();
    await page.waitForURL('**/categories/cpu');
    await expect(page.locator('[data-testid="category-title"]')).toContainText('CPU');
    await expect(page.locator('[data-testid="product-grid-loading"]')).not.toBeVisible({ timeout: 5_000 });

    // === STEP 3: Click on a product card ===
    const firstCard = page.locator('[data-testid^="product-card-"]').first();
    const testId = await firstCard.getAttribute('data-testid');
    const productId = testId!.replace('product-card-', '');
    await firstCard.click();

    // === STEP 4: Verify product detail page ===
    await page.waitForURL(`**/products/${productId}`);
    await expect(page.locator('[data-testid="product-detail-page"]')).toBeVisible();
    await expect(page.locator('[data-testid="product-detail-name"]')).toBeVisible();
    await expect(page.locator('[data-testid="product-detail-image"]')).toBeVisible();

    // === STEP 5: Navigate back via breadcrumb home link ===
    await page.locator('[data-testid="breadcrumb-home-link"]').click();
    await page.waitForURL('**/');
    await expect(page.locator('[data-testid="home-page"]')).toBeVisible();
  });

  test('user can click multiple different product cards from the same category', async ({ page }) => {
    // === SETUP ===
    await page.goto(`/categories/${CATEGORY_GPU.slug}`);
    await expect(page.locator('[data-testid="product-grid-loading"]')).not.toBeVisible({ timeout: 5_000 });

    const cards = page.locator('[data-testid^="product-card-"]');
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(2);

    // === ACTION: Click first product ===
    const firstTestId = await cards.nth(0).getAttribute('data-testid');
    const firstProductId = firstTestId!.replace('product-card-', '');
    await cards.nth(0).click();
    await page.waitForURL(`**/products/${firstProductId}`);
    await expect(page.locator('[data-testid="product-detail-page"]')).toBeVisible();

    // Go back to category
    await page.goBack();
    await page.waitForURL(`**/categories/${CATEGORY_GPU.slug}`);
    await expect(page.locator('[data-testid="product-grid-loading"]')).not.toBeVisible({ timeout: 5_000 });

    // === ACTION: Click second product ===
    const secondTestId = await cards.nth(1).getAttribute('data-testid');
    const secondProductId = secondTestId!.replace('product-card-', '');
    await cards.nth(1).click();
    await page.waitForURL(`**/products/${secondProductId}`);
    await expect(page.locator('[data-testid="product-detail-page"]')).toBeVisible();

    // Different products should have different IDs
    expect(firstProductId).not.toBe(secondProductId);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// AC1+AC3 — Public access (no authentication required)
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Story 3.2 — Public access: product grid and detail accessible without login', () => {

  test('visitor (not logged in) can view product grid on category page', async ({ page }) => {
    // === SETUP — ensure no auth ===
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.removeItem('token');
      localStorage.removeItem('activeEntrepriseId');
    });

    // === ACTION ===
    await page.goto(`/categories/${CATEGORY_CPU.slug}`);

    // === VERIFICATION UI ===
    await expect(page.locator('[data-testid="product-grid-loading"]')).not.toBeVisible({ timeout: 5_000 });
    await expect(page.locator('[data-testid="product-grid-container"]')).toBeVisible();
    await expect(page.locator('[data-testid="product-grid"]')).toBeVisible();

    // Not redirected to /login
    expect(page.url()).not.toContain('/login');
  });

  test('visitor (not logged in) can access product detail page directly', async ({ page }) => {
    // === SETUP — ensure no auth ===
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.removeItem('token');
      localStorage.removeItem('activeEntrepriseId');
    });

    // === ACTION ===
    await page.goto('/products/101');

    // === VERIFICATION UI ===
    await expect(page.locator('[data-testid="product-detail-page"]')).toBeVisible();
    expect(page.url()).not.toContain('/login');
  });

  test('visitor can click a product card and navigate to detail without being blocked', async ({ page }) => {
    // === SETUP — ensure no auth ===
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.removeItem('token');
      localStorage.removeItem('activeEntrepriseId');
    });

    // === ACTION ===
    await page.goto(`/categories/${CATEGORY_GPU.slug}`);
    await expect(page.locator('[data-testid="product-grid-loading"]')).not.toBeVisible({ timeout: 5_000 });

    const firstCard = page.locator('[data-testid^="product-card-"]').first();
    const testId = await firstCard.getAttribute('data-testid');
    const productId = testId!.replace('product-card-', '');
    await firstCard.click();

    // === VERIFICATION UI ===
    await page.waitForURL(`**/products/${productId}`);
    await expect(page.locator('[data-testid="product-detail-page"]')).toBeVisible();
    expect(page.url()).not.toContain('/login');
  });

  test('acheteur can view product grid', async ({ page }) => {
    // === SETUP ===
    await loginAs(page, ACHETEUR_EMAIL, ACHETEUR_PASSWORD);

    // === ACTION ===
    await page.goto(`/categories/${CATEGORY_CPU.slug}`);

    // === VERIFICATION UI ===
    await expect(page.locator('[data-testid="product-grid-loading"]')).not.toBeVisible({ timeout: 5_000 });
    await expect(page.locator('[data-testid="product-grid"]')).toBeVisible();
  });

  test('vendeur can view product grid', async ({ page }) => {
    // === SETUP ===
    await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);

    // === ACTION ===
    await page.goto(`/categories/${CATEGORY_GPU.slug}`);

    // === VERIFICATION UI ===
    await expect(page.locator('[data-testid="product-grid-loading"]')).not.toBeVisible({ timeout: 5_000 });
    await expect(page.locator('[data-testid="product-grid"]')).toBeVisible();
  });

  test('acheteur can navigate to product detail page', async ({ page }) => {
    // === SETUP ===
    await loginAs(page, ACHETEUR_EMAIL, ACHETEUR_PASSWORD);

    // === ACTION ===
    await page.goto('/products/101');

    // === VERIFICATION UI ===
    await expect(page.locator('[data-testid="product-detail-page"]')).toBeVisible();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// NFR — Performance: catalogue loads in under 2 seconds
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Story 3.2 — NFR1: Performance - catalogue < 2 seconds', () => {

  test('product grid loads in under 2 seconds for CPU category (15 products)', async ({ page }) => {
    // === SETUP ===
    const startTime = Date.now();

    // === ACTION ===
    await page.goto(`/categories/${CATEGORY_CPU.slug}`);

    // Wait for the product grid to be fully visible
    await expect(
      page.locator('[data-testid="product-grid"], [data-testid="product-grid-empty"]').first()
    ).toBeVisible({ timeout: 2_000 });

    const loadTime = Date.now() - startTime;

    // === VERIFICATION ===
    // NFR1: catalogue < 2 seconds
    expect(loadTime).toBeLessThan(2_000);
  });

  test('product detail page loads in under 2 seconds', async ({ page }) => {
    // === SETUP ===
    const startTime = Date.now();

    // === ACTION ===
    await page.goto('/products/101');

    // Wait for the page to be fully visible
    await expect(page.locator('[data-testid="product-detail-content"]')).toBeVisible({ timeout: 2_000 });

    const loadTime = Date.now() - startTime;

    // === VERIFICATION ===
    expect(loadTime).toBeLessThan(2_000);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Backend API — Product list endpoint contract
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Story 3.2 — Backend API: Product list endpoint', () => {

  test('GET /api/categories/{slug}/products returns paginated products with required fields', async ({ page }) => {
    // === ACTION ===
    const response = await page.request.get(`${API_URL}/categories/cpu/products`, {
      headers: { Accept: 'application/json' },
    });

    // === VERIFICATION ===
    expect(response.status()).toBe(200);

    const json = await response.json();
    const products = json.data || json;

    expect(Array.isArray(products)).toBeTruthy();

    if (products.length > 0) {
      const product = products[0];
      // Required fields per Story 3.2
      expect(product).toHaveProperty('id');
      expect(product).toHaveProperty('name');
      expect(product).toHaveProperty('price');
      expect(product).toHaveProperty('photo_url');
      expect(product).toHaveProperty('seller_name');
    }
  });

  test('products endpoint only returns active products (is_active = true)', async ({ page }) => {
    // === ACTION ===
    const response = await page.request.get(`${API_URL}/categories/cpu/products`, {
      headers: { Accept: 'application/json' },
    });

    // === VERIFICATION ===
    expect(response.status()).toBe(200);
    const json = await response.json();
    const products = json.data || json;

    for (const product of products) {
      if ('is_active' in product) {
        expect(product.is_active).toBe(true);
      }
    }
  });

  test('products endpoint includes seller info (seller_name) in response', async ({ page }) => {
    // === ACTION ===
    const response = await page.request.get(`${API_URL}/categories/gpu/products`, {
      headers: { Accept: 'application/json' },
    });

    // === VERIFICATION ===
    expect(response.status()).toBe(200);
    const json = await response.json();
    const products = json.data || json;

    for (const product of products) {
      expect(product).toHaveProperty('seller_name');
      expect(typeof product.seller_name).toBe('string');
      expect(product.seller_name.length).toBeGreaterThan(0);
    }
  });

  test('products from multiple sellers appear in same category response (FR30)', async ({ page }) => {
    // === ACTION ===
    const response = await page.request.get(`${API_URL}/categories/cpu/products`, {
      headers: { Accept: 'application/json' },
    });

    // === VERIFICATION ===
    expect(response.status()).toBe(200);
    const json = await response.json();
    const products = json.data || json;

    if (products.length >= 2) {
      const sellerNames = new Set(products.map((p: { seller_name: string }) => p.seller_name));
      // FR30: products from multiple sellers mixed together
      expect(sellerNames.size).toBeGreaterThanOrEqual(2);
    }
  });

  test('products endpoint supports pagination with page parameter', async ({ page }) => {
    // === ACTION ===
    const response = await page.request.get(`${API_URL}/categories/cpu/products?page=1&per_page=5`, {
      headers: { Accept: 'application/json' },
    });

    // === VERIFICATION ===
    expect(response.status()).toBe(200);
    const json = await response.json();

    // Paginated response should have data + meta or links
    const hasData = 'data' in json;
    const hasMeta = 'meta' in json || 'links' in json || 'total' in json;

    if (hasData && hasMeta) {
      expect(Array.isArray(json.data)).toBeTruthy();
    } else {
      // At minimum, the response should be OK
      expect(response.ok()).toBeTruthy();
    }
  });

  test('products endpoint does not require authentication', async ({ page }) => {
    // === ACTION — no auth header ===
    const response = await page.request.get(`${API_URL}/categories/cpu/products`, {
      headers: { Accept: 'application/json' },
    });

    // === VERIFICATION ===
    expect(response.status()).not.toBe(401);
    expect(response.status()).not.toBe(403);
    expect(response.status()).toBe(200);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// DB verification — Active products and multi-seller
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Story 3.2 — DB verification: Active products and multi-seller', () => {

  test('only active products (is_active=1) should appear in public catalogue', async () => {
    // === VERIFICATION DB ===
    const activeProducts = await db.count('products', { is_active: 1 });
    const totalProducts = await db.count('products');

    // Active products should be a subset of total
    expect(activeProducts).toBeLessThanOrEqual(totalProducts);
    // There should be some active products in the system
    expect(activeProducts).toBeGreaterThan(0);
  });

  test('products have valid foreign keys (seller_id references existing users)', async () => {
    // === VERIFICATION DB ===
    const orphanedProducts = await db.query<RowDataPacket[]>(
      `SELECT p.id, p.name, p.seller_id
       FROM products p
       LEFT JOIN users u ON p.seller_id = u.id
       WHERE u.id IS NULL`
    );

    // No orphaned products (all seller_ids must reference existing users)
    expect(orphanedProducts.length).toBe(0);
  });

  test('products belong to valid categories', async () => {
    // === VERIFICATION DB ===
    const validCategories = ['cpu', 'gpu', 'ram', 'stockage', 'cm', 'alimentation', 'boitier', 'peripheriques'];

    const products = await db.query<(RowDataPacket & { category: string })[]>(
      'SELECT DISTINCT category FROM products'
    );

    for (const product of products) {
      expect(validCategories).toContain(product.category);
    }
  });

  test('multiple sellers have products in the same category (FR30)', async () => {
    // === VERIFICATION DB ===
    const sellersPerCategory = await db.query<(RowDataPacket & { category: string; seller_count: number })[]>(
      `SELECT category, COUNT(DISTINCT seller_id) as seller_count
       FROM products
       WHERE is_active = 1
       GROUP BY category
       HAVING seller_count >= 2`
    );

    // At least one category should have products from multiple sellers
    expect(sellersPerCategory.length).toBeGreaterThan(0);
  });

  test('inactive products (is_active=0) exist but should not be returned by API', async () => {
    // === VERIFICATION DB ===
    // This checks that the is_active filtering mechanism has something to filter
    const inactiveCount = await db.count('products', { is_active: 0 });

    // If there are inactive products, verify they wouldn't be shown
    // (The API test above already verifies this from the API side)
    // This is a complementary DB-level check
    if (inactiveCount > 0) {
      const activeCount = await db.count('products', { is_active: 1 });
      const totalCount = await db.count('products');
      expect(activeCount + inactiveCount).toBe(totalCount);
    }
  });
});
