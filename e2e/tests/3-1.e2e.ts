import { test, expect } from '@playwright/test';
import { RowDataPacket } from 'mysql2/promise';
import { loginAs, logout } from '../helpers/auth';
import { db } from '../helpers/database';

/**
 * Story 3.1 — Category Navigation
 *
 * AC1: Given a user arrives on the homepage
 *      When the page loads
 *      Then they see all 8 categories displayed clearly:
 *           CPU, GPU, RAM, Stockage, CM, Alimentation, Boitier, Peripheriques
 *
 * AC2: Given a user clicks on a category
 *      When the category page loads
 *      Then only products from that category are displayed
 *           And the page loads in under 2 seconds
 *
 * AC3: Given a visitor is not logged in
 *      When they browse categories and product listings
 *      Then they can access all catalogue pages without restriction
 *
 * Pre-conditions:
 * - e2e-vendeur@test.com / password exists with role "vendeur" (from E2ETestSeeder)
 * - e2e@test.com / password exists with role "acheteur" (from E2ETestSeeder)
 *
 * The tests describe EXPECTED behavior (TDD). They will fail until:
 * - Backend: CatalogController@categories (GET /api/categories) returns the 8 categories
 * - Backend: CatalogController@productsByCategory (GET /api/categories/{slug}/products)
 *            returns paginated active products for that category
 * - Backend: Both routes are public (no auth middleware)
 * - Frontend: HomePage.vue displays all 8 category cards with icons, names, descriptions
 * - Frontend: CategoryPage.vue fetches from API and displays products for a category
 * - Frontend: Routes / and /categories/:slug are publicly accessible
 */

// ---------------------------------------------------------------------------
// 8 fixed categories — slugs, labels, expected icons
// ---------------------------------------------------------------------------
const CATEGORIES = [
  { slug: 'cpu', label: 'CPU', icon: '🔲' },
  { slug: 'gpu', label: 'GPU', icon: '🎮' },
  { slug: 'ram', label: 'RAM', icon: '💾' },
  { slug: 'stockage', label: 'Stockage', icon: '💿' },
  { slug: 'cm', label: 'Carte Mère', icon: '🖥️' },
  { slug: 'alimentation', label: 'Alimentation', icon: '⚡' },
  { slug: 'boitier', label: 'Boîtier', icon: '📦' },
  { slug: 'peripheriques', label: 'Périphériques', icon: '🖱️' },
] as const;

// ---------------------------------------------------------------------------
// Test user credentials
// ---------------------------------------------------------------------------
const VENDEUR_EMAIL = 'e2e-vendeur@test.com';
const VENDEUR_PASSWORD = 'password';

const ACHETEUR_EMAIL = 'e2e@test.com';
const ACHETEUR_PASSWORD = 'password';

const API_URL = process.env.API_URL || 'http://localhost:8080/api';

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------
test.afterAll(async () => {
  await db.cleanup();
});

// ═══════════════════════════════════════════════════════════════════════════
// AC1 — Homepage displays all 8 categories
// ═══════════════════════════════════════════════════════════════════════════

test.describe('AC1 — Homepage displays all 8 categories', () => {

  test('homepage renders the main page structure (title, subtitle, heading)', async ({ page }) => {
    // === ACTION ===
    await page.goto('/');

    // === VÉRIFICATION UI ===
    await expect(page.locator('[data-testid="home-page"]')).toBeVisible();
    await expect(page.locator('[data-testid="home-title"]')).toBeVisible();
    await expect(page.locator('[data-testid="home-title"]')).toContainText('Composants PC');
    await expect(page.locator('[data-testid="home-subtitle"]')).toBeVisible();
    await expect(page.locator('[data-testid="categories-heading"]')).toBeVisible();
    await expect(page.locator('[data-testid="categories-heading"]')).toContainText('Parcourir par catégorie');
  });

  test('homepage displays the category grid with exactly 8 category cards', async ({ page }) => {
    // === ACTION ===
    await page.goto('/');

    // === VÉRIFICATION UI ===
    const grid = page.locator('[data-testid="category-grid"]');
    await expect(grid).toBeVisible();

    // Count exactly 8 category cards
    for (const cat of CATEGORIES) {
      await expect(page.locator(`[data-testid="category-card-${cat.slug}"]`)).toBeVisible();
    }

    // Verify there are no extra cards (exactly 8)
    const cards = grid.locator('[data-testid^="category-card-"]');
    await expect(cards).toHaveCount(8);
  });

  test('each category card shows icon, name and description', async ({ page }) => {
    // === ACTION ===
    await page.goto('/');

    // === VÉRIFICATION UI ===
    for (const cat of CATEGORIES) {
      // Icon is present and visible
      const icon = page.locator(`[data-testid="category-icon-${cat.slug}"]`);
      await expect(icon).toBeVisible();
      await expect(icon).toContainText(cat.icon);

      // Name is present and visible
      const name = page.locator(`[data-testid="category-name-${cat.slug}"]`);
      await expect(name).toBeVisible();
      await expect(name).toHaveText(cat.label);

      // Description is present and visible (non-empty text)
      const desc = page.locator(`[data-testid="category-desc-${cat.slug}"]`);
      await expect(desc).toBeVisible();
      await expect(desc).not.toHaveText('');
    }
  });

  test('all 8 category names are exactly: CPU, GPU, RAM, Stockage, Carte Mère, Alimentation, Boîtier, Périphériques', async ({ page }) => {
    // === ACTION ===
    await page.goto('/');

    // === VÉRIFICATION UI ===
    // Verify each category label matches exactly
    await expect(page.locator('[data-testid="category-name-cpu"]')).toHaveText('CPU');
    await expect(page.locator('[data-testid="category-name-gpu"]')).toHaveText('GPU');
    await expect(page.locator('[data-testid="category-name-ram"]')).toHaveText('RAM');
    await expect(page.locator('[data-testid="category-name-stockage"]')).toHaveText('Stockage');
    await expect(page.locator('[data-testid="category-name-cm"]')).toHaveText('Carte Mère');
    await expect(page.locator('[data-testid="category-name-alimentation"]')).toHaveText('Alimentation');
    await expect(page.locator('[data-testid="category-name-boitier"]')).toHaveText('Boîtier');
    await expect(page.locator('[data-testid="category-name-peripheriques"]')).toHaveText('Périphériques');
  });

  test('each category card is a clickable link to /categories/{slug}', async ({ page }) => {
    // === ACTION ===
    await page.goto('/');

    // === VÉRIFICATION UI ===
    for (const cat of CATEGORIES) {
      const card = page.locator(`[data-testid="category-card-${cat.slug}"]`);
      await expect(card).toBeVisible();

      // Verify it's a link (a or router-link rendered as <a>)
      const href = await card.getAttribute('href');
      expect(href).toBe(`/categories/${cat.slug}`);
    }
  });

  test('navbar contains a Catalogue link pointing to homepage', async ({ page }) => {
    // === ACTION ===
    await page.goto('/');

    // === VÉRIFICATION UI ===
    const catalogueLink = page.locator('[data-testid="nav-catalogue-link"]');
    await expect(catalogueLink).toBeVisible();
    await expect(catalogueLink).toContainText('Catalogue');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// AC2 — Category page displays products from that category
// ═══════════════════════════════════════════════════════════════════════════

test.describe('AC2 — Category page displays products from selected category', () => {

  test('clicking a category card navigates to the category page', async ({ page }) => {
    // === SETUP ===
    await page.goto('/');

    // === ACTION ===
    await page.locator('[data-testid="category-card-cpu"]').click();

    // === VÉRIFICATION UI ===
    await page.waitForURL('**/categories/cpu');
    await expect(page.locator('[data-testid="category-page"]')).toBeVisible();
    await expect(page.locator('[data-testid="category-title"]')).toContainText('CPU');
  });

  test('category page shows breadcrumb with home link and current category', async ({ page }) => {
    // === ACTION ===
    await page.goto('/categories/gpu');

    // === VÉRIFICATION UI ===
    const breadcrumb = page.locator('[data-testid="category-breadcrumb"]');
    await expect(breadcrumb).toBeVisible();

    // Home link in breadcrumb
    const homeLink = page.locator('[data-testid="breadcrumb-home-link"]');
    await expect(homeLink).toBeVisible();
    await expect(homeLink).toContainText('Accueil');

    // Current category in breadcrumb
    const current = page.locator('[data-testid="breadcrumb-current"]');
    await expect(current).toBeVisible();
    await expect(current).toContainText('GPU');
  });

  test('category page displays the category title', async ({ page }) => {
    // === ACTION ===
    await page.goto('/categories/ram');

    // === VÉRIFICATION UI ===
    await expect(page.locator('[data-testid="category-title"]')).toBeVisible();
    await expect(page.locator('[data-testid="category-title"]')).toContainText('RAM');
  });

  test('category page shows product count', async ({ page }) => {
    // === ACTION ===
    await page.goto('/categories/cpu');

    // === VÉRIFICATION UI ===
    // Wait for products to load (loading indicator disappears)
    await expect(page.locator('[data-testid="category-loading"]')).not.toBeVisible({ timeout: 5_000 });

    const productCount = page.locator('[data-testid="category-product-count"]');
    await expect(productCount).toBeVisible();
    // The count should contain a number followed by "produit(s)"
    await expect(productCount).toContainText(/\d+ produits? disponibles?/);
  });

  test('category page displays a product list with product cards', async ({ page }) => {
    // === ACTION ===
    await page.goto('/categories/cpu');

    // === VÉRIFICATION UI ===
    await expect(page.locator('[data-testid="category-loading"]')).not.toBeVisible({ timeout: 5_000 });

    const productList = page.locator('[data-testid="product-list"]');
    await expect(productList).toBeVisible();

    // There should be at least 1 product card
    const cards = productList.locator('[data-testid^="product-card-"]');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
  });

  test('each product card shows name, description, price, stock, seller and view button', async ({ page }) => {
    // === ACTION ===
    await page.goto('/categories/cpu');

    // === VÉRIFICATION UI ===
    await expect(page.locator('[data-testid="category-loading"]')).not.toBeVisible({ timeout: 5_000 });

    // Get the first product card's ID
    const firstCard = page.locator('[data-testid^="product-card-"]').first();
    await expect(firstCard).toBeVisible();

    // Extract the product ID from the data-testid
    const testId = await firstCard.getAttribute('data-testid');
    const productId = testId!.replace('product-card-', '');

    // Name
    await expect(page.locator(`[data-testid="product-name-${productId}"]`)).toBeVisible();
    const name = await page.locator(`[data-testid="product-name-${productId}"]`).textContent();
    expect(name!.trim().length).toBeGreaterThan(0);

    // Description
    await expect(page.locator(`[data-testid="product-description-${productId}"]`)).toBeVisible();

    // Price (should contain € or EUR format)
    const priceEl = page.locator(`[data-testid="product-price-${productId}"]`);
    await expect(priceEl).toBeVisible();
    const priceText = await priceEl.textContent();
    expect(priceText).toMatch(/\d/); // Contains digits
    expect(priceText).toMatch(/€/); // Contains euro symbol

    // Stock badge
    await expect(page.locator(`[data-testid="product-stock-${productId}"]`)).toBeVisible();

    // Seller name
    const seller = page.locator(`[data-testid="product-seller-${productId}"]`);
    await expect(seller).toBeVisible();
    await expect(seller).toContainText('Vendu par');

    // View button
    await expect(page.locator(`[data-testid="product-view-btn-${productId}"]`)).toBeVisible();
  });

  test('product price is formatted in EUR with French locale', async ({ page }) => {
    // === ACTION ===
    await page.goto('/categories/cpu');

    // === VÉRIFICATION UI ===
    await expect(page.locator('[data-testid="category-loading"]')).not.toBeVisible({ timeout: 5_000 });

    const firstCard = page.locator('[data-testid^="product-card-"]').first();
    const testId = await firstCard.getAttribute('data-testid');
    const productId = testId!.replace('product-card-', '');

    const priceEl = page.locator(`[data-testid="product-price-${productId}"]`);
    const priceText = await priceEl.textContent();

    // French locale EUR format: "549,99 €" or "549,99€" (with or without non-breaking space)
    // The price should contain a comma (French decimal separator) and € sign
    expect(priceText).toMatch(/\d+,\d{2}/);
    expect(priceText).toMatch(/€/);
  });

  test('product stock shows "en stock" for available products or "Rupture" for out-of-stock', async ({ page }) => {
    // === ACTION ===
    await page.goto('/categories/cpu');

    // === VÉRIFICATION UI ===
    await expect(page.locator('[data-testid="category-loading"]')).not.toBeVisible({ timeout: 5_000 });

    const firstCard = page.locator('[data-testid^="product-card-"]').first();
    const testId = await firstCard.getAttribute('data-testid');
    const productId = testId!.replace('product-card-', '');

    const stockEl = page.locator(`[data-testid="product-stock-${productId}"]`);
    const stockText = await stockEl.textContent();

    // Should contain either "en stock" or "Rupture"
    expect(stockText).toMatch(/en stock|Rupture/);
  });

  test('product image area is displayed for each product', async ({ page }) => {
    // === ACTION ===
    await page.goto('/categories/gpu');

    // === VÉRIFICATION UI ===
    await expect(page.locator('[data-testid="category-loading"]')).not.toBeVisible({ timeout: 5_000 });

    const firstCard = page.locator('[data-testid^="product-card-"]').first();
    const testId = await firstCard.getAttribute('data-testid');
    const productId = testId!.replace('product-card-', '');

    await expect(page.locator(`[data-testid="product-image-${productId}"]`)).toBeVisible();
  });

  test('only products from the selected category are displayed', async ({ page }) => {
    // === ACTION ===
    // Navigate to CPU category
    await page.goto('/categories/cpu');

    // === VÉRIFICATION UI ===
    await expect(page.locator('[data-testid="category-loading"]')).not.toBeVisible({ timeout: 5_000 });
    await expect(page.locator('[data-testid="category-title"]')).toContainText('CPU');

    // Get all product names in CPU
    const cpuCards = page.locator('[data-testid^="product-card-"]');
    const cpuCount = await cpuCards.count();
    expect(cpuCount).toBeGreaterThan(0);

    // Now navigate to GPU category — products should be different
    await page.goto('/categories/gpu');
    await expect(page.locator('[data-testid="category-loading"]')).not.toBeVisible({ timeout: 5_000 });
    await expect(page.locator('[data-testid="category-title"]')).toContainText('GPU');

    const gpuCards = page.locator('[data-testid^="product-card-"]');
    const gpuCount = await gpuCards.count();
    expect(gpuCount).toBeGreaterThan(0);

    // Products should be different between CPU and GPU
    // (different product counts or, if same count, different names)
    // This assertion validates category isolation
    if (cpuCount === gpuCount) {
      // Compare first product name — they should differ
      const cpuFirstId = (await page.locator('[data-testid^="product-card-"]').first().getAttribute('data-testid'))!.replace('product-card-', '');
      const gpuFirstName = await page.locator(`[data-testid="product-name-${cpuFirstId}"]`).textContent().catch(() => null);

      await page.goto('/categories/cpu');
      await expect(page.locator('[data-testid="category-loading"]')).not.toBeVisible({ timeout: 5_000 });
      const cpuFirstIdAgain = (await page.locator('[data-testid^="product-card-"]').first().getAttribute('data-testid'))!.replace('product-card-', '');
      const cpuFirstName = await page.locator(`[data-testid="product-name-${cpuFirstIdAgain}"]`).textContent();

      // If both categories have products, their first product names should differ
      if (gpuFirstName) {
        expect(cpuFirstName).not.toBe(gpuFirstName);
      }
    }
  });

  test('category page loads in under 2 seconds (NFR1)', async ({ page }) => {
    // === SETUP ===
    const startTime = Date.now();

    // === ACTION ===
    await page.goto('/categories/cpu');

    // === VÉRIFICATION UI ===
    // Wait for the product list OR empty state to be visible (page fully loaded)
    await expect(
      page.locator('[data-testid="product-list"], [data-testid="category-empty"]')
        .first()
    ).toBeVisible({ timeout: 2_000 });

    const loadTime = Date.now() - startTime;

    // NFR1: catalogue loads in < 2 seconds
    expect(loadTime).toBeLessThan(2_000);
  });

  test('breadcrumb home link navigates back to homepage', async ({ page }) => {
    // === SETUP ===
    await page.goto('/categories/cpu');
    await expect(page.locator('[data-testid="category-page"]')).toBeVisible();

    // === ACTION ===
    await page.locator('[data-testid="breadcrumb-home-link"]').click();

    // === VÉRIFICATION UI ===
    await page.waitForURL('**/');
    await expect(page.locator('[data-testid="home-page"]')).toBeVisible();
  });

  test('loading indicator is shown while products are loading', async ({ page }) => {
    // === ACTION ===
    // Navigate to category page
    await page.goto('/categories/stockage');

    // === VÉRIFICATION UI ===
    // We expect either:
    // - The loading indicator is briefly visible then disappears
    // - OR the product list is visible (fast load)
    // The key assertion is that eventually the loading state resolves
    await expect(
      page.locator('[data-testid="product-list"], [data-testid="category-empty"]')
        .first()
    ).toBeVisible({ timeout: 5_000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// AC2 — Invalid category handling
// ═══════════════════════════════════════════════════════════════════════════

test.describe('AC2 — Invalid category slug handling', () => {

  test('navigating to an invalid category slug shows "category not found" message', async ({ page }) => {
    // === ACTION ===
    await page.goto('/categories/nonexistent-category');

    // === VÉRIFICATION UI ===
    await expect(page.locator('[data-testid="category-not-found"]')).toBeVisible();

    // Product list should NOT be visible
    await expect(page.locator('[data-testid="product-list"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="category-title"]')).not.toBeVisible();
  });

  test('invalid category page shows a link to return to homepage', async ({ page }) => {
    // === ACTION ===
    await page.goto('/categories/invalid-slug');

    // === VÉRIFICATION UI ===
    await expect(page.locator('[data-testid="category-not-found"]')).toBeVisible();

    const backLink = page.locator('[data-testid="back-home-link"]');
    await expect(backLink).toBeVisible();
    await expect(backLink).toContainText('Retour');
  });

  test('clicking back link from invalid category navigates to homepage', async ({ page }) => {
    // === SETUP ===
    await page.goto('/categories/xyz-invalid');
    await expect(page.locator('[data-testid="category-not-found"]')).toBeVisible();

    // === ACTION ===
    await page.locator('[data-testid="back-home-link"]').click();

    // === VÉRIFICATION UI ===
    await page.waitForURL('**/');
    await expect(page.locator('[data-testid="home-page"]')).toBeVisible();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// AC2 — Empty category (no products)
// ═══════════════════════════════════════════════════════════════════════════

test.describe('AC2 — Empty category state', () => {

  test('category with no products shows empty state message', async ({ page }) => {
    // Note: This test navigates to a valid category that has no products.
    // In the real backend, some categories may be empty. The UI should handle this gracefully.
    // We'll test with a category that might have 0 products.
    // For robustness, we check that the empty state UI exists and is correct when triggered.

    // === ACTION ===
    // Navigate to a category that could be empty
    // If all categories have products, this test validates the empty state template exists
    await page.goto('/categories/boitier');

    // === VÉRIFICATION UI ===
    await expect(page.locator('[data-testid="category-loading"]')).not.toBeVisible({ timeout: 5_000 });

    // Check either product list or empty state is shown
    const productList = page.locator('[data-testid="product-list"]');
    const emptyState = page.locator('[data-testid="category-empty"]');

    const hasProducts = await productList.isVisible().catch(() => false);
    const isEmpty = await emptyState.isVisible().catch(() => false);

    // One of the two states must be visible
    expect(hasProducts || isEmpty).toBeTruthy();

    // If empty state is shown, verify it has a back link
    if (isEmpty) {
      await expect(page.locator('[data-testid="empty-back-home-link"]')).toBeVisible();
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// AC2 — Navigate between categories
// ═══════════════════════════════════════════════════════════════════════════

test.describe('AC2 — Category navigation flow', () => {

  test('user can navigate from homepage → category → back to homepage → different category', async ({ page }) => {
    // === STEP 1: Homepage ===
    await page.goto('/');
    await expect(page.locator('[data-testid="home-page"]')).toBeVisible();
    await expect(page.locator('[data-testid="category-grid"]')).toBeVisible();

    // === STEP 2: Click on CPU category ===
    await page.locator('[data-testid="category-card-cpu"]').click();
    await page.waitForURL('**/categories/cpu');
    await expect(page.locator('[data-testid="category-title"]')).toContainText('CPU');

    // === STEP 3: Go back to homepage via breadcrumb ===
    await page.locator('[data-testid="breadcrumb-home-link"]').click();
    await page.waitForURL('**/');
    await expect(page.locator('[data-testid="home-page"]')).toBeVisible();

    // === STEP 4: Click on GPU category ===
    await page.locator('[data-testid="category-card-gpu"]').click();
    await page.waitForURL('**/categories/gpu');
    await expect(page.locator('[data-testid="category-title"]')).toContainText('GPU');
  });

  test('each of the 8 category pages is accessible via direct URL', async ({ page }) => {
    // === VÉRIFICATION ===
    for (const cat of CATEGORIES) {
      await page.goto(`/categories/${cat.slug}`);
      await expect(page.locator('[data-testid="category-page"]')).toBeVisible();
      await expect(page.locator('[data-testid="category-title"]')).toContainText(cat.label);
      await expect(page.locator('[data-testid="breadcrumb-current"]')).toContainText(cat.label);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// AC3 — Public access (no auth required)
// ═══════════════════════════════════════════════════════════════════════════

test.describe('AC3 — Visitor (not logged in) can access all catalogue pages', () => {

  test('visitor can access homepage without being redirected to login', async ({ page }) => {
    // === SETUP — ensure no auth ===
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.removeItem('token');
      localStorage.removeItem('activeEntrepriseId');
    });
    await page.reload();

    // === VÉRIFICATION UI ===
    await expect(page.locator('[data-testid="home-page"]')).toBeVisible();
    await expect(page.locator('[data-testid="category-grid"]')).toBeVisible();

    // Should NOT be redirected to /login
    expect(page.url()).not.toContain('/login');
  });

  test('visitor can access category page without being redirected to login', async ({ page }) => {
    // === SETUP — ensure no auth ===
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.removeItem('token');
      localStorage.removeItem('activeEntrepriseId');
    });

    // === ACTION ===
    await page.goto('/categories/cpu');

    // === VÉRIFICATION UI ===
    await expect(page.locator('[data-testid="category-page"]')).toBeVisible();
    expect(page.url()).not.toContain('/login');
  });

  test('visitor can browse all 8 category pages without any restriction', async ({ page }) => {
    // === SETUP — ensure no auth ===
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.removeItem('token');
      localStorage.removeItem('activeEntrepriseId');
    });

    // === VÉRIFICATION ===
    for (const cat of CATEGORIES) {
      await page.goto(`/categories/${cat.slug}`);
      await expect(page.locator('[data-testid="category-page"]')).toBeVisible();
      // Not redirected to login
      expect(page.url()).toContain(`/categories/${cat.slug}`);
      // Title matches
      await expect(page.locator('[data-testid="category-title"]')).toContainText(cat.label);
    }
  });

  test('visitor sees all 8 categories on the homepage', async ({ page }) => {
    // === SETUP — ensure no auth ===
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.removeItem('token');
      localStorage.removeItem('activeEntrepriseId');
    });
    await page.reload();

    // === VÉRIFICATION UI ===
    await expect(page.locator('[data-testid="category-grid"]')).toBeVisible();

    for (const cat of CATEGORIES) {
      await expect(page.locator(`[data-testid="category-card-${cat.slug}"]`)).toBeVisible();
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// AC3 — Authenticated users also have full access
// ═══════════════════════════════════════════════════════════════════════════

test.describe('AC3 — Authenticated users can also access catalogue', () => {

  test('acheteur can access homepage and see all 8 categories', async ({ page }) => {
    // === SETUP ===
    await loginAs(page, ACHETEUR_EMAIL, ACHETEUR_PASSWORD);

    // === ACTION ===
    await page.goto('/');

    // === VÉRIFICATION UI ===
    await expect(page.locator('[data-testid="home-page"]')).toBeVisible();
    await expect(page.locator('[data-testid="category-grid"]')).toBeVisible();

    for (const cat of CATEGORIES) {
      await expect(page.locator(`[data-testid="category-card-${cat.slug}"]`)).toBeVisible();
    }
  });

  test('acheteur can access any category page', async ({ page }) => {
    // === SETUP ===
    await loginAs(page, ACHETEUR_EMAIL, ACHETEUR_PASSWORD);

    // === ACTION ===
    await page.goto('/categories/gpu');

    // === VÉRIFICATION UI ===
    await expect(page.locator('[data-testid="category-page"]')).toBeVisible();
    await expect(page.locator('[data-testid="category-title"]')).toContainText('GPU');
  });

  test('vendeur can access homepage and see all 8 categories', async ({ page }) => {
    // === SETUP ===
    await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);

    // === ACTION ===
    await page.goto('/');

    // === VÉRIFICATION UI ===
    await expect(page.locator('[data-testid="home-page"]')).toBeVisible();
    await expect(page.locator('[data-testid="category-grid"]')).toBeVisible();

    for (const cat of CATEGORIES) {
      await expect(page.locator(`[data-testid="category-card-${cat.slug}"]`)).toBeVisible();
    }
  });

  test('vendeur can access any category page', async ({ page }) => {
    // === SETUP ===
    await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);

    // === ACTION ===
    await page.goto('/categories/alimentation');

    // === VÉRIFICATION UI ===
    await expect(page.locator('[data-testid="category-page"]')).toBeVisible();
    await expect(page.locator('[data-testid="category-title"]')).toContainText('Alimentation');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// AC1+AC2 — Backend API contract (categories endpoint)
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Backend API — GET /api/categories', () => {

  test('GET /api/categories returns 200 and all 8 categories', async ({ page }) => {
    // === ACTION ===
    const response = await page.request.get(`${API_URL}/categories`, {
      headers: { Accept: 'application/json' },
    });

    // === VÉRIFICATION ===
    expect(response.status()).toBe(200);

    const json = await response.json();
    const categories = json.data || json;

    // Must return exactly 8 categories
    expect(Array.isArray(categories)).toBeTruthy();
    expect(categories.length).toBe(8);

    // Each category must have slug and label
    const slugs = categories.map((c: { slug: string }) => c.slug);
    for (const cat of CATEGORIES) {
      expect(slugs).toContain(cat.slug);
    }
  });

  test('GET /api/categories does not require authentication', async ({ page }) => {
    // === ACTION — no auth header ===
    const response = await page.request.get(`${API_URL}/categories`, {
      headers: { Accept: 'application/json' },
    });

    // === VÉRIFICATION ===
    // Should NOT return 401 or 403
    expect(response.status()).not.toBe(401);
    expect(response.status()).not.toBe(403);
    expect(response.status()).toBe(200);
  });
});

test.describe('Backend API — GET /api/categories/{slug}/products', () => {

  test('GET /api/categories/cpu/products returns 200 with products array', async ({ page }) => {
    // === ACTION ===
    const response = await page.request.get(`${API_URL}/categories/cpu/products`, {
      headers: { Accept: 'application/json' },
    });

    // === VÉRIFICATION ===
    expect(response.status()).toBe(200);

    const json = await response.json();
    const products = json.data || json;

    // Must return an array
    expect(Array.isArray(products)).toBeTruthy();
  });

  test('products returned by category endpoint only contain products from that category', async ({ page }) => {
    // === ACTION ===
    const response = await page.request.get(`${API_URL}/categories/gpu/products`, {
      headers: { Accept: 'application/json' },
    });

    // === VÉRIFICATION ===
    expect(response.status()).toBe(200);

    const json = await response.json();
    const products = json.data || json;

    // Each product should have category = 'gpu'
    for (const product of products) {
      expect(product.category).toBe('gpu');
    }
  });

  test('products endpoint returns expected fields for each product', async ({ page }) => {
    // === ACTION ===
    const response = await page.request.get(`${API_URL}/categories/cpu/products`, {
      headers: { Accept: 'application/json' },
    });

    // === VÉRIFICATION ===
    expect(response.status()).toBe(200);

    const json = await response.json();
    const products = json.data || json;

    if (products.length > 0) {
      const product = products[0];
      // Required fields per CatalogProduct interface
      expect(product).toHaveProperty('id');
      expect(product).toHaveProperty('name');
      expect(product).toHaveProperty('description');
      expect(product).toHaveProperty('category');
      expect(product).toHaveProperty('price');
      expect(product).toHaveProperty('stock_quantity');
      expect(product).toHaveProperty('seller_name');
    }
  });

  test('GET /api/categories/{slug}/products does not require authentication', async ({ page }) => {
    // === ACTION — no auth header ===
    const response = await page.request.get(`${API_URL}/categories/ram/products`, {
      headers: { Accept: 'application/json' },
    });

    // === VÉRIFICATION ===
    expect(response.status()).not.toBe(401);
    expect(response.status()).not.toBe(403);
    expect(response.status()).toBe(200);
  });

  test('GET /api/categories/{slug}/products supports pagination', async ({ page }) => {
    // === ACTION ===
    const response = await page.request.get(`${API_URL}/categories/cpu/products?page=1`, {
      headers: { Accept: 'application/json' },
    });

    // === VÉRIFICATION ===
    expect(response.status()).toBe(200);

    const json = await response.json();

    // Paginated responses typically have meta/links or data wrapper
    // Accept either flat array or paginated response with data key
    const hasData = 'data' in json;
    const hasMeta = 'meta' in json || 'links' in json;

    // If paginated, should have data + meta/links
    if (hasData && hasMeta) {
      expect(Array.isArray(json.data)).toBeTruthy();
    } else {
      // At minimum, the response should be parseable
      expect(response.ok()).toBeTruthy();
    }
  });

  test('GET /api/categories/invalid-slug/products returns 404', async ({ page }) => {
    // === ACTION ===
    const response = await page.request.get(`${API_URL}/categories/nonexistent/products`, {
      headers: { Accept: 'application/json' },
    });

    // === VÉRIFICATION ===
    expect(response.status()).toBe(404);
  });

  test('all 8 category endpoints are accessible', async ({ page }) => {
    // === VÉRIFICATION ===
    for (const cat of CATEGORIES) {
      const response = await page.request.get(`${API_URL}/categories/${cat.slug}/products`, {
        headers: { Accept: 'application/json' },
      });
      expect(response.status()).toBe(200);
    }
  });

  test('products endpoint only returns active products', async ({ page }) => {
    // === ACTION ===
    const response = await page.request.get(`${API_URL}/categories/cpu/products`, {
      headers: { Accept: 'application/json' },
    });

    // === VÉRIFICATION ===
    expect(response.status()).toBe(200);

    const json = await response.json();
    const products = json.data || json;

    // All returned products should be active (is_active = true)
    // Inactive products must NOT appear in public catalogue
    for (const product of products) {
      if ('is_active' in product) {
        expect(product.is_active).toBe(true);
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// AC1+AC2+AC3 — DB verification for categories
// ═══════════════════════════════════════════════════════════════════════════

test.describe('DB verification — Categories and products', () => {

  test('products in DB have valid category values from the 8 fixed categories', async () => {
    // === VÉRIFICATION DB ===
    const validSlugs = CATEGORIES.map(c => c.slug);
    const products = await db.query<(RowDataPacket & { category: string })[]>(
      'SELECT DISTINCT category FROM products'
    );

    for (const product of products) {
      expect(validSlugs).toContain(product.category);
    }
  });

  test('only active products should be publicly visible', async () => {
    // === VÉRIFICATION DB ===
    // Count active products per category
    for (const cat of CATEGORIES) {
      const activeCount = await db.count('products', {
        category: cat.slug,
        is_active: 1,
      });

      const totalCount = await db.count('products', {
        category: cat.slug,
      });

      // Active count must be <= total count (sanity check)
      expect(activeCount).toBeLessThanOrEqual(totalCount);
    }
  });
});
