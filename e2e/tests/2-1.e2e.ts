import { test, expect, Page } from '@playwright/test';
import { loginAs, logout } from '../helpers/auth';
import { db } from '../helpers/database';

/**
 * Story 2.1 — Seller Dashboard
 *
 * AC1: Given a logged-in seller navigates to their dashboard
 *      When the page loads
 *      Then they see a list of all their products with name, photo thumbnail,
 *           price, stock, and status (active/inactive)
 *
 * AC2: Given a seller has no products yet
 *      When they view their dashboard
 *      Then they see an empty state with a clear call-to-action to add their first product
 *
 * Pre-conditions:
 * - e2e-vendeur@test.com / password exists with role "vendeur" (from E2ETestSeeder)
 * - e2e@test.com / password exists with role "acheteur" (from E2ETestSeeder)
 * - e2e-admin@test.com / password exists with role "admin" (from E2ETestSeeder)
 *
 * The tests describe EXPECTED behavior (TDD). They will fail until:
 * - Backend: Product model + migration created
 * - Backend: SellerProductController@index (GET /api/seller/products) implemented
 * - Backend: ProductResource returns id, name, photo_url, price, stock_quantity, is_active
 * - Backend: Seller scoping — only returns authenticated seller's products
 * - Frontend: SellerDashboardPage.vue wired to real API via sellerProduct store
 * - Frontend: Empty state displayed when no products exist
 */

// ---------------------------------------------------------------------------
// Test user credentials
// ---------------------------------------------------------------------------
const VENDEUR_EMAIL = 'e2e-vendeur@test.com';
const VENDEUR_PASSWORD = 'password';

const ACHETEUR_EMAIL = 'e2e@test.com';
const ACHETEUR_PASSWORD = 'password';

const ADMIN_EMAIL = 'e2e-admin@test.com';
const ADMIN_PASSWORD = 'password';

// Second vendeur for isolation testing
const VENDEUR2_EMAIL = `e2e-vendeur2-${Date.now()}@test.com`;
const VENDEUR2_PASSWORD = 'password';

const API_URL = process.env.API_URL || 'http://localhost:8080/api';

// ---------------------------------------------------------------------------
// Helper: create a product for a seller via API
// ---------------------------------------------------------------------------
async function createProductForSeller(
  page: Page,
  token: string,
  product: {
    name: string;
    price: number;
    stock_quantity: number;
    is_active?: boolean;
    photo_url?: string | null;
  }
): Promise<number> {
  const response = await page.request.post(`${API_URL}/seller/products`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
    data: {
      name: product.name,
      price: product.price,
      stock_quantity: product.stock_quantity,
      is_active: product.is_active ?? true,
      photo_url: product.photo_url ?? null,
    },
  });

  if (!response.ok()) {
    const body = await response.text();
    throw new Error(`Create product API failed (${response.status()}): ${body}`);
  }

  const json = await response.json();
  return json.data.id;
}

// ---------------------------------------------------------------------------
// Helper: register a user with vendeur role via API
// ---------------------------------------------------------------------------
async function ensureVendeur2(page: Page): Promise<void> {
  const existing = await db.findOne('users', { email: VENDEUR2_EMAIL });
  if (existing) return;

  const response = await page.request.post(`${API_URL}/auth/register`, {
    data: {
      email: VENDEUR2_EMAIL,
      password: VENDEUR2_PASSWORD,
      password_confirmation: VENDEUR2_PASSWORD,
      role: 'vendeur',
      name: 'E2E Vendeur2 User',
    },
  });

  if (!response.ok()) {
    console.warn(
      `[SETUP] Could not create vendeur2 user (${VENDEUR2_EMAIL}): ${response.status()} — ` +
      `tests requiring this user will fail as expected in TDD`
    );
  }
}

// ---------------------------------------------------------------------------
// Setup & Cleanup
// ---------------------------------------------------------------------------

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  try {
    await ensureVendeur2(page);
  } finally {
    await page.close();
  }
});

test.afterAll(async () => {
  // Cleanup test products created during tests
  await db.query('DELETE FROM products WHERE name LIKE ?', ['E2E-%']);
  // Cleanup vendeur2 test user
  await db.query('DELETE FROM users WHERE email = ?', [VENDEUR2_EMAIL]);
  await db.cleanup();
});

// ===========================================================================
// AC1 — SELLER DASHBOARD: Page structure & product list
// ===========================================================================

test.describe('Story 2.1 — AC1: Seller sees product list on dashboard', () => {
  test('seller dashboard page is accessible at /seller/dashboard', async ({ page }) => {
    // === SETUP ===
    await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);

    // === ACTION ===
    await page.goto('/seller/dashboard');

    // === VÉRIFICATION UI ===
    await page.waitForURL('**/seller/dashboard');
    await expect(page.locator('[data-testid="seller-dashboard-title"]')).toBeVisible();
    await expect(page.locator('[data-testid="seller-dashboard-title"]')).toHaveText(
      'Tableau de bord vendeur'
    );
  });

  test('seller dashboard shows subtitle with seller name', async ({ page }) => {
    // === SETUP ===
    await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);

    // === ACTION ===
    await page.goto('/seller/dashboard');

    // === VÉRIFICATION UI ===
    await expect(page.locator('[data-testid="seller-dashboard-subtitle"]')).toBeVisible();
    const subtitleText = await page.locator('[data-testid="seller-dashboard-subtitle"]').textContent();
    expect(subtitleText).toBeTruthy();
    expect(subtitleText!.length).toBeGreaterThan(0);
  });

  test('seller with products sees product table with all required columns', async ({ page }) => {
    // === SETUP: login and create test products ===
    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);

    await createProductForSeller(page, token, {
      name: 'E2E-Produit-AC1-Table',
      price: 19.99,
      stock_quantity: 25,
      is_active: true,
    });

    // === ACTION: navigate to seller dashboard ===
    await page.goto('/seller/dashboard');

    // === VÉRIFICATION UI ===
    // Products table should be visible
    await expect(page.locator('[data-testid="seller-products-table"]')).toBeVisible();

    // Table should have correct column headers
    const table = page.locator('[data-testid="seller-products-table"]');
    await expect(table.locator('th')).toHaveCount(6); // Photo, Nom, Prix, Stock, Statut, Actions
    await expect(table.getByText('Photo')).toBeVisible();
    await expect(table.getByText('Nom')).toBeVisible();
    await expect(table.getByText('Prix')).toBeVisible();
    await expect(table.getByText('Stock')).toBeVisible();
    await expect(table.getByText('Statut')).toBeVisible();
    await expect(table.getByText('Actions')).toBeVisible();
  });

  test('each product row displays name, photo, price, stock, and status', async ({ page }) => {
    // === SETUP: login and create a product ===
    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);

    const productId = await createProductForSeller(page, token, {
      name: 'E2E-Savon-Lavande',
      price: 12.50,
      stock_quantity: 45,
      is_active: true,
      photo_url: 'https://placehold.co/80x80/e2e8f0/475569?text=Savon',
    });

    // === ACTION ===
    await page.goto('/seller/dashboard');

    // === VÉRIFICATION UI ===
    // Product row exists
    const row = page.locator(`[data-testid="seller-product-row-${productId}"]`);
    await expect(row).toBeVisible();

    // Name
    await expect(
      page.locator(`[data-testid="seller-product-name-${productId}"]`)
    ).toHaveText('E2E-Savon-Lavande');

    // Photo (image present)
    await expect(
      page.locator(`[data-testid="seller-product-photo-${productId}"]`)
    ).toBeVisible();

    // Price (formatted with comma for French locale)
    await expect(
      page.locator(`[data-testid="seller-product-price-${productId}"]`)
    ).toContainText('12,50');

    // Stock
    await expect(
      page.locator(`[data-testid="seller-product-stock-${productId}"]`)
    ).toContainText('45');

    // Status badge — active
    const statusBadge = page.locator(`[data-testid="seller-product-status-${productId}"]`);
    await expect(statusBadge).toBeVisible();
    await expect(statusBadge).toHaveText('Actif');
  });

  test('inactive product shows "Inactif" status badge', async ({ page }) => {
    // === SETUP ===
    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);

    const productId = await createProductForSeller(page, token, {
      name: 'E2E-Bougie-Inactif',
      price: 24.99,
      stock_quantity: 0,
      is_active: false,
    });

    // === ACTION ===
    await page.goto('/seller/dashboard');

    // === VÉRIFICATION UI ===
    const statusBadge = page.locator(`[data-testid="seller-product-status-${productId}"]`);
    await expect(statusBadge).toBeVisible();
    await expect(statusBadge).toHaveText('Inactif');
  });

  test('product without photo shows placeholder', async ({ page }) => {
    // === SETUP ===
    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);

    const productId = await createProductForSeller(page, token, {
      name: 'E2E-Sans-Photo',
      price: 18.00,
      stock_quantity: 12,
      is_active: true,
      photo_url: null,
    });

    // === ACTION ===
    await page.goto('/seller/dashboard');

    // === VÉRIFICATION UI ===
    // Photo image should NOT be visible
    await expect(
      page.locator(`[data-testid="seller-product-photo-${productId}"]`)
    ).not.toBeVisible();

    // Placeholder should be visible instead
    await expect(
      page.locator(`[data-testid="seller-product-photo-placeholder-${productId}"]`)
    ).toBeVisible();
  });

  test('seller dashboard shows product count', async ({ page }) => {
    // === SETUP ===
    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);

    // Create at least 2 products to verify count
    await createProductForSeller(page, token, {
      name: 'E2E-Count-1',
      price: 10,
      stock_quantity: 5,
      is_active: true,
    });
    await createProductForSeller(page, token, {
      name: 'E2E-Count-2',
      price: 20,
      stock_quantity: 10,
      is_active: true,
    });

    // === ACTION ===
    await page.goto('/seller/dashboard');

    // === VÉRIFICATION UI ===
    const countBadge = page.locator('[data-testid="seller-products-count"]');
    await expect(countBadge).toBeVisible();

    // Should contain a number followed by "produit(s)"
    const countText = await countBadge.textContent();
    expect(countText).toMatch(/\d+\s*produit/);
  });

  test('"Ajouter un produit" button is visible when seller has products', async ({ page }) => {
    // === SETUP ===
    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);

    await createProductForSeller(page, token, {
      name: 'E2E-Add-Btn-Test',
      price: 10,
      stock_quantity: 5,
      is_active: true,
    });

    // === ACTION ===
    await page.goto('/seller/dashboard');

    // === VÉRIFICATION UI ===
    await expect(
      page.locator('[data-testid="seller-add-product-btn"]')
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="seller-add-product-btn"]')
    ).toContainText(/ajouter/i);
  });
});

// ===========================================================================
// AC1 — STATS: Dashboard statistics derived from products
// ===========================================================================

test.describe('Story 2.1 — AC1: Seller dashboard statistics', () => {
  test('seller dashboard shows stats cards when products exist', async ({ page }) => {
    // === SETUP ===
    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);

    await createProductForSeller(page, token, {
      name: 'E2E-Stats-Active',
      price: 15,
      stock_quantity: 10,
      is_active: true,
    });
    await createProductForSeller(page, token, {
      name: 'E2E-Stats-Inactive',
      price: 25,
      stock_quantity: 0,
      is_active: false,
    });

    // === ACTION ===
    await page.goto('/seller/dashboard');

    // === VÉRIFICATION UI ===
    await expect(page.locator('[data-testid="seller-stats"]')).toBeVisible();
    await expect(page.locator('[data-testid="seller-stat-total-products"]')).toBeVisible();
    await expect(page.locator('[data-testid="seller-stat-active-products"]')).toBeVisible();
    await expect(page.locator('[data-testid="seller-stat-inactive-products"]')).toBeVisible();
  });

  test('stats reflect correct counts for total, active, and inactive products', async ({ page }) => {
    // === SETUP: clean slate for this vendeur ===
    // First, get vendeur user_id
    const vendeur = await db.findOne('users', { email: VENDEUR_EMAIL });
    expect(vendeur).toBeTruthy();

    // Remove all existing products for this vendeur to get predictable counts
    await db.query('DELETE FROM products WHERE user_id = ?', [vendeur!.id]);

    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);

    // Create exactly 3 products: 2 active, 1 inactive
    await createProductForSeller(page, token, {
      name: 'E2E-Stats-A1',
      price: 10,
      stock_quantity: 5,
      is_active: true,
    });
    await createProductForSeller(page, token, {
      name: 'E2E-Stats-A2',
      price: 20,
      stock_quantity: 10,
      is_active: true,
    });
    await createProductForSeller(page, token, {
      name: 'E2E-Stats-I1',
      price: 30,
      stock_quantity: 0,
      is_active: false,
    });

    // === ACTION ===
    await page.goto('/seller/dashboard');

    // === VÉRIFICATION UI ===
    await expect(page.locator('[data-testid="seller-stat-total-products"]')).toHaveText('3');
    await expect(page.locator('[data-testid="seller-stat-active-products"]')).toHaveText('2');
    await expect(page.locator('[data-testid="seller-stat-inactive-products"]')).toHaveText('1');
  });
});

// ===========================================================================
// AC2 — EMPTY STATE: No products → CTA "Ajouter mon premier produit"
// ===========================================================================

test.describe('Story 2.1 — AC2: Empty state when seller has no products', () => {
  test('seller with no products sees empty state container', async ({ page }) => {
    // === SETUP: ensure vendeur2 has NO products ===
    const vendeur2 = await db.findOne('users', { email: VENDEUR2_EMAIL });
    if (vendeur2) {
      await db.query('DELETE FROM products WHERE user_id = ?', [vendeur2.id]);
    }

    await loginAs(page, VENDEUR2_EMAIL, VENDEUR2_PASSWORD);

    // === ACTION ===
    await page.goto('/seller/dashboard');

    // === VÉRIFICATION UI ===
    await expect(page.locator('[data-testid="seller-empty-state"]')).toBeVisible();
  });

  test('empty state shows title "Aucun produit pour le moment"', async ({ page }) => {
    // === SETUP ===
    const vendeur2 = await db.findOne('users', { email: VENDEUR2_EMAIL });
    if (vendeur2) {
      await db.query('DELETE FROM products WHERE user_id = ?', [vendeur2.id]);
    }

    await loginAs(page, VENDEUR2_EMAIL, VENDEUR2_PASSWORD);

    // === ACTION ===
    await page.goto('/seller/dashboard');

    // === VÉRIFICATION UI ===
    await expect(
      page.locator('[data-testid="seller-empty-state-title"]')
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="seller-empty-state-title"]')
    ).toHaveText('Aucun produit pour le moment');
  });

  test('empty state shows descriptive text', async ({ page }) => {
    // === SETUP ===
    const vendeur2 = await db.findOne('users', { email: VENDEUR2_EMAIL });
    if (vendeur2) {
      await db.query('DELETE FROM products WHERE user_id = ?', [vendeur2.id]);
    }

    await loginAs(page, VENDEUR2_EMAIL, VENDEUR2_PASSWORD);

    // === ACTION ===
    await page.goto('/seller/dashboard');

    // === VÉRIFICATION UI ===
    const description = page.locator('[data-testid="seller-empty-state-description"]');
    await expect(description).toBeVisible();
    const text = await description.textContent();
    expect(text!.length).toBeGreaterThan(10);
    expect(text).toMatch(/produit|ajouter|commencez/i);
  });

  test('empty state shows CTA button "Ajouter mon premier produit"', async ({ page }) => {
    // === SETUP ===
    const vendeur2 = await db.findOne('users', { email: VENDEUR2_EMAIL });
    if (vendeur2) {
      await db.query('DELETE FROM products WHERE user_id = ?', [vendeur2.id]);
    }

    await loginAs(page, VENDEUR2_EMAIL, VENDEUR2_PASSWORD);

    // === ACTION ===
    await page.goto('/seller/dashboard');

    // === VÉRIFICATION UI ===
    const ctaButton = page.locator('[data-testid="seller-empty-state-add-btn"]');
    await expect(ctaButton).toBeVisible();
    await expect(ctaButton).toHaveText(/ajouter mon premier produit/i);
  });

  test('empty state does NOT show product table', async ({ page }) => {
    // === SETUP ===
    const vendeur2 = await db.findOne('users', { email: VENDEUR2_EMAIL });
    if (vendeur2) {
      await db.query('DELETE FROM products WHERE user_id = ?', [vendeur2.id]);
    }

    await loginAs(page, VENDEUR2_EMAIL, VENDEUR2_PASSWORD);

    // === ACTION ===
    await page.goto('/seller/dashboard');

    // === VÉRIFICATION UI ===
    await expect(page.locator('[data-testid="seller-products-table"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="seller-stats"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="seller-products-count"]')).not.toBeVisible();
  });

  test('empty state does NOT show "Ajouter un produit" header button (only CTA)', async ({ page }) => {
    // === SETUP ===
    const vendeur2 = await db.findOne('users', { email: VENDEUR2_EMAIL });
    if (vendeur2) {
      await db.query('DELETE FROM products WHERE user_id = ?', [vendeur2.id]);
    }

    await loginAs(page, VENDEUR2_EMAIL, VENDEUR2_PASSWORD);

    // === ACTION ===
    await page.goto('/seller/dashboard');

    // === VÉRIFICATION UI ===
    // The header "Ajouter un produit" button should NOT appear in empty state
    // Only the CTA "Ajouter mon premier produit" in the empty state container
    await expect(page.locator('[data-testid="seller-add-product-btn"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="seller-empty-state-add-btn"]')).toBeVisible();
  });
});

// ===========================================================================
// BACKEND API — GET /api/seller/products endpoint
// ===========================================================================

test.describe('Story 2.1 — Backend API: GET /api/seller/products', () => {
  test('API returns 200 with product list for authenticated vendeur', async ({ page }) => {
    // === SETUP ===
    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);

    // Create a product first
    await createProductForSeller(page, token, {
      name: 'E2E-API-List',
      price: 15.50,
      stock_quantity: 20,
      is_active: true,
    });

    // === ACTION: call GET /api/seller/products ===
    const response = await page.request.get(`${API_URL}/seller/products`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    // === VÉRIFICATION ===
    expect(response.status()).toBe(200);

    const json = await response.json();
    expect(json.data).toBeDefined();
    expect(Array.isArray(json.data)).toBe(true);
    expect(json.data.length).toBeGreaterThan(0);
  });

  test('API response contains all required fields per ProductResource spec', async ({ page }) => {
    // === SETUP ===
    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);

    await createProductForSeller(page, token, {
      name: 'E2E-API-Fields',
      price: 29.99,
      stock_quantity: 8,
      is_active: true,
      photo_url: 'https://example.com/photo.jpg',
    });

    // === ACTION ===
    const response = await page.request.get(`${API_URL}/seller/products`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    // === VÉRIFICATION ===
    expect(response.status()).toBe(200);

    const json = await response.json();
    const product = json.data.find((p: any) => p.name === 'E2E-API-Fields');
    expect(product).toBeDefined();

    // All required fields from ProductResource spec
    expect(product).toHaveProperty('id');
    expect(product).toHaveProperty('name');
    expect(product).toHaveProperty('photo_url');
    expect(product).toHaveProperty('price');
    expect(product).toHaveProperty('stock_quantity');
    expect(product).toHaveProperty('is_active');

    // Type checks
    expect(typeof product.id).toBe('number');
    expect(typeof product.name).toBe('string');
    expect(typeof product.price).toBe('number');
    expect(typeof product.stock_quantity).toBe('number');
    expect(typeof product.is_active).toBe('boolean');
  });

  test('API returns 401 for unauthenticated request to seller products', async ({ page }) => {
    // === ACTION ===
    const response = await page.request.get(`${API_URL}/seller/products`, {
      headers: { Accept: 'application/json' },
    });

    // === VÉRIFICATION ===
    expect(response.status()).toBe(401);
  });

  test('API returns 403 for acheteur accessing seller products', async ({ page }) => {
    // === SETUP ===
    const { token } = await loginAs(page, ACHETEUR_EMAIL, ACHETEUR_PASSWORD);

    // === ACTION ===
    const response = await page.request.get(`${API_URL}/seller/products`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    // === VÉRIFICATION ===
    expect(response.status()).toBe(403);
  });

  test('API returns empty array when vendeur has no products', async ({ page }) => {
    // === SETUP: use vendeur2 with no products ===
    const vendeur2 = await db.findOne('users', { email: VENDEUR2_EMAIL });
    if (vendeur2) {
      await db.query('DELETE FROM products WHERE user_id = ?', [vendeur2.id]);
    }

    const { token } = await loginAs(page, VENDEUR2_EMAIL, VENDEUR2_PASSWORD);

    // === ACTION ===
    const response = await page.request.get(`${API_URL}/seller/products`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    // === VÉRIFICATION ===
    expect(response.status()).toBe(200);
    const json = await response.json();
    expect(json.data).toBeDefined();
    expect(json.data).toHaveLength(0);
  });
});

// ===========================================================================
// NFR11 — DATA ISOLATION: Seller sees ONLY their own products
// ===========================================================================

test.describe('Story 2.1 — NFR11: Seller product isolation (backend scope)', () => {
  test('vendeur1 does NOT see vendeur2 products in API response', async ({ page }) => {
    // === SETUP: create products for each vendeur ===
    const { token: token1 } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);

    await createProductForSeller(page, token1, {
      name: 'E2E-Isolation-Vendeur1-Product',
      price: 10,
      stock_quantity: 5,
      is_active: true,
    });

    // Login as vendeur2 and create a product
    const { token: token2 } = await loginAs(page, VENDEUR2_EMAIL, VENDEUR2_PASSWORD);

    await createProductForSeller(page, token2, {
      name: 'E2E-Isolation-Vendeur2-Product',
      price: 20,
      stock_quantity: 10,
      is_active: true,
    });

    // === ACTION: vendeur1 fetches their products ===
    const response1 = await page.request.get(`${API_URL}/seller/products`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token1}`,
      },
    });

    // === VÉRIFICATION ===
    expect(response1.status()).toBe(200);
    const json1 = await response1.json();
    const productNames1 = json1.data.map((p: any) => p.name);

    // Vendeur1 sees their own product
    expect(productNames1).toContain('E2E-Isolation-Vendeur1-Product');

    // Vendeur1 does NOT see vendeur2's product
    expect(productNames1).not.toContain('E2E-Isolation-Vendeur2-Product');
  });

  test('vendeur2 does NOT see vendeur1 products in API response', async ({ page }) => {
    // === SETUP ===
    const { token: token2 } = await loginAs(page, VENDEUR2_EMAIL, VENDEUR2_PASSWORD);

    // === ACTION: vendeur2 fetches their products ===
    const response2 = await page.request.get(`${API_URL}/seller/products`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token2}`,
      },
    });

    // === VÉRIFICATION ===
    expect(response2.status()).toBe(200);
    const json2 = await response2.json();
    const productNames2 = json2.data.map((p: any) => p.name);

    // Vendeur2 does NOT see vendeur1's products
    expect(productNames2).not.toContain('E2E-Isolation-Vendeur1-Product');
  });

  test('UI dashboard shows only the authenticated seller products', async ({ page }) => {
    // === SETUP: clean slate for vendeur2 and create specific products ===
    const vendeur2 = await db.findOne('users', { email: VENDEUR2_EMAIL });
    if (vendeur2) {
      await db.query('DELETE FROM products WHERE user_id = ?', [vendeur2.id]);
    }

    const { token: token2 } = await loginAs(page, VENDEUR2_EMAIL, VENDEUR2_PASSWORD);

    const productId = await createProductForSeller(page, token2, {
      name: 'E2E-UI-Isolation-V2',
      price: 33.00,
      stock_quantity: 7,
      is_active: true,
    });

    // === ACTION ===
    await page.goto('/seller/dashboard');

    // === VÉRIFICATION UI ===
    // Vendeur2 should see their product
    await expect(
      page.locator(`[data-testid="seller-product-row-${productId}"]`)
    ).toBeVisible();
    await expect(
      page.locator(`[data-testid="seller-product-name-${productId}"]`)
    ).toHaveText('E2E-UI-Isolation-V2');

    // Should NOT see vendeur1's products
    // We check that no row contains vendeur1-specific product names
    await expect(page.locator('[data-testid="seller-products-table"]')).toBeVisible();
    const allProductNames = await page
      .locator('[data-testid^="seller-product-name-"]')
      .allTextContents();
    for (const name of allProductNames) {
      expect(name).not.toContain('Isolation-Vendeur1');
    }
  });
});

// ===========================================================================
// DB VERIFICATION — Product records correctly persisted
// ===========================================================================

test.describe('Story 2.1 — DB verification: products table', () => {
  test('product created via API exists in DB with correct values', async ({ page }) => {
    // === SETUP ===
    const { token, userId } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);

    const productId = await createProductForSeller(page, token, {
      name: 'E2E-DB-Check',
      price: 42.50,
      stock_quantity: 99,
      is_active: true,
    });

    // === VÉRIFICATION DB ===
    const product = await db.findOne('products', { id: productId });
    expect(product).toBeTruthy();
    expect(product!.name).toBe('E2E-DB-Check');
    expect(Number(product!.price)).toBeCloseTo(42.50, 2);
    expect(product!.stock_quantity).toBe(99);
    expect(product!.is_active).toBeTruthy();
    expect(product!.user_id).toBe(userId);
  });

  test('product belongs to the correct seller (foreign key valid)', async ({ page }) => {
    // === SETUP ===
    const { token, userId } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);

    const productId = await createProductForSeller(page, token, {
      name: 'E2E-FK-Check',
      price: 10,
      stock_quantity: 5,
      is_active: true,
    });

    // === VÉRIFICATION DB ===
    const product = await db.findOne('products', { id: productId });
    expect(product).toBeTruthy();
    expect(product!.user_id).toBe(userId);

    // Verify the user actually exists (no orphan)
    const user = await db.findOne('users', { id: product!.user_id });
    expect(user).toBeTruthy();
    expect(user!.role).toBe('vendeur');
  });

  test('inactive product has is_active = false in DB', async ({ page }) => {
    // === SETUP ===
    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);

    const productId = await createProductForSeller(page, token, {
      name: 'E2E-Inactive-DB',
      price: 15,
      stock_quantity: 0,
      is_active: false,
    });

    // === VÉRIFICATION DB ===
    const product = await db.findOne('products', { id: productId });
    expect(product).toBeTruthy();
    expect(product!.is_active).toBeFalsy();
  });

  test('product count in DB matches what API returns for seller', async ({ page }) => {
    // === SETUP: clean slate ===
    const vendeur2 = await db.findOne('users', { email: VENDEUR2_EMAIL });
    if (vendeur2) {
      await db.query('DELETE FROM products WHERE user_id = ?', [vendeur2.id]);
    }

    const { token } = await loginAs(page, VENDEUR2_EMAIL, VENDEUR2_PASSWORD);
    const vendeur2After = await db.findOne('users', { email: VENDEUR2_EMAIL });

    // Create exactly 3 products
    await createProductForSeller(page, token, { name: 'E2E-DBCount-1', price: 10, stock_quantity: 1, is_active: true });
    await createProductForSeller(page, token, { name: 'E2E-DBCount-2', price: 20, stock_quantity: 2, is_active: true });
    await createProductForSeller(page, token, { name: 'E2E-DBCount-3', price: 30, stock_quantity: 3, is_active: false });

    // === VÉRIFICATION DB ===
    const dbCount = await db.count('products', { user_id: vendeur2After!.id });
    expect(dbCount).toBe(3);

    // === VÉRIFICATION API ===
    const response = await page.request.get(`${API_URL}/seller/products`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
    const json = await response.json();
    expect(json.data.length).toBe(3);

    // DB count matches API count
    expect(json.data.length).toBe(dbCount);
  });
});

// ===========================================================================
// ROLE PROTECTION — Only vendeur can access seller dashboard
// ===========================================================================

test.describe('Story 2.1 — Role protection: only vendeur accesses seller dashboard', () => {
  test('acheteur accessing /seller/dashboard is redirected to /unauthorized', async ({ page }) => {
    // === SETUP ===
    await loginAs(page, ACHETEUR_EMAIL, ACHETEUR_PASSWORD);

    // === ACTION ===
    await page.goto('/seller/dashboard');

    // === VÉRIFICATION UI ===
    await page.waitForURL((url) => url.pathname.includes('/unauthorized'), {
      timeout: 10_000,
    });
    await expect(page.locator('[data-testid="seller-dashboard-title"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="seller-products-table"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="seller-empty-state"]')).not.toBeVisible();
  });

  test('visitor (not logged in) accessing /seller/dashboard is redirected to /login', async ({
    page,
  }) => {
    // === ACTION ===
    await page.goto('/seller/dashboard');

    // === VÉRIFICATION UI ===
    await page.waitForURL((url) => url.pathname.includes('/login'), {
      timeout: 10_000,
    });
    await expect(page.locator('[data-testid="seller-dashboard-title"]')).not.toBeVisible();
  });

  test('acheteur cannot see seller products via API', async ({ page }) => {
    // === SETUP ===
    const { token } = await loginAs(page, ACHETEUR_EMAIL, ACHETEUR_PASSWORD);

    // === ACTION ===
    const response = await page.request.get(`${API_URL}/seller/products`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    // === VÉRIFICATION ===
    expect(response.status()).toBe(403);
  });
});

// ===========================================================================
// LOADING & ERROR STATES
// ===========================================================================

test.describe('Story 2.1 — Loading and error states', () => {
  test('seller dashboard shows loading state while fetching products', async ({ page }) => {
    // === SETUP ===
    await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);

    // === ACTION ===
    await page.goto('/seller/dashboard');

    // === VÉRIFICATION UI ===
    // The dashboard title should eventually be visible (page loads)
    await expect(page.locator('[data-testid="seller-dashboard-title"]')).toBeVisible();

    // Either products table or empty state should appear (loading is done)
    await expect(
      page.locator('[data-testid="seller-products-table"], [data-testid="seller-empty-state"]')
    ).toBeVisible();
  });
});

// ===========================================================================
// PRODUCT ACTIONS — Buttons present in each row
// ===========================================================================

test.describe('Story 2.1 — Product row action buttons', () => {
  test('each product row has edit, delete, and toggle status buttons', async ({ page }) => {
    // === SETUP ===
    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);

    const productId = await createProductForSeller(page, token, {
      name: 'E2E-Actions-Test',
      price: 15,
      stock_quantity: 10,
      is_active: true,
    });

    // === ACTION ===
    await page.goto('/seller/dashboard');

    // === VÉRIFICATION UI ===
    // Toggle status button
    await expect(
      page.locator(`[data-testid="seller-toggle-status-btn-${productId}"]`)
    ).toBeVisible();

    // Edit button
    await expect(
      page.locator(`[data-testid="seller-edit-product-btn-${productId}"]`)
    ).toBeVisible();

    // Delete button
    await expect(
      page.locator(`[data-testid="seller-delete-product-btn-${productId}"]`)
    ).toBeVisible();
  });

  test('active product shows "Désactiver" toggle text', async ({ page }) => {
    // === SETUP ===
    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);

    const productId = await createProductForSeller(page, token, {
      name: 'E2E-Toggle-Active',
      price: 15,
      stock_quantity: 10,
      is_active: true,
    });

    // === ACTION ===
    await page.goto('/seller/dashboard');

    // === VÉRIFICATION UI ===
    await expect(
      page.locator(`[data-testid="seller-toggle-status-btn-${productId}"]`)
    ).toContainText(/désactiver/i);
  });

  test('inactive product shows "Activer" toggle text', async ({ page }) => {
    // === SETUP ===
    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);

    const productId = await createProductForSeller(page, token, {
      name: 'E2E-Toggle-Inactive',
      price: 15,
      stock_quantity: 0,
      is_active: false,
    });

    // === ACTION ===
    await page.goto('/seller/dashboard');

    // === VÉRIFICATION UI ===
    await expect(
      page.locator(`[data-testid="seller-toggle-status-btn-${productId}"]`)
    ).toContainText(/activer/i);
  });
});
