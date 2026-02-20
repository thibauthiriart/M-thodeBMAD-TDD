import { test, expect, Page } from '@playwright/test';
import { loginAs, logout } from '../helpers/auth';
import { db } from '../helpers/database';

/**
 * Story 2.4 — Activate / Deactivate Product
 *
 * AC1: Given a seller views an active product in their dashboard
 *      When they click "Deactivate"
 *      Then the product status changes to inactive
 *           and it is no longer visible in the public catalogue
 *
 * AC2: Given a seller views an inactive product in their dashboard
 *      When they click "Activate"
 *      Then the product status changes to active
 *           and it becomes visible in the public catalogue
 *
 * Pre-conditions:
 * - e2e-vendeur@test.com / password exists with role "vendeur" (from E2ETestSeeder)
 * - e2e@test.com / password exists with role "acheteur" (from E2ETestSeeder)
 * - e2e-admin@test.com / password exists with role "admin" (from E2ETestSeeder)
 *
 * The tests describe EXPECTED behavior (TDD). They will fail until:
 * - Backend: SellerProductController@toggleStatus (PATCH /api/seller/products/{id}/toggle-status)
 * - Backend: Toggle is_active boolean, scope to authenticated seller
 * - Backend: Return updated ProductResource
 * - Frontend: SellerDashboardPage calls API on toggle, updates product in store
 * - Frontend: Status badge updates immediately (optimistic UI)
 * - Frontend: Feedback toast shown after toggle
 * - Public catalogue only shows products with is_active = true
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

// Second vendeur for ownership/isolation testing
const VENDEUR2_EMAIL = `e2e-vendeur2-24-${Date.now()}@test.com`;
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
      name: 'E2E Vendeur2 Story24',
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
  // Cleanup test products created during these tests
  await db.query('DELETE FROM products WHERE name LIKE ?', ['E2E-24-%']);
  // Cleanup vendeur2 test user
  await db.query('DELETE FROM users WHERE email = ?', [VENDEUR2_EMAIL]);
  await db.cleanup();
});

// ===========================================================================
// AC1 — DEACTIVATE: Active → Inactive via UI
// ===========================================================================

test.describe('Story 2.4 — AC1: Deactivate an active product', () => {
  test('clicking "Désactiver" on an active product changes status badge to "Inactif"', async ({ page }) => {
    // === SETUP ===
    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);

    const productId = await createProductForSeller(page, token, {
      name: 'E2E-24-Deactivate-Badge',
      price: 49.99,
      stock_quantity: 10,
      is_active: true,
    });

    // === ACTION: navigate to dashboard and click Désactiver ===
    await page.goto('/seller/dashboard');

    // Verify product is initially active
    const statusBadge = page.locator(`[data-testid="seller-product-status-${productId}"]`);
    await expect(statusBadge).toHaveText('Actif');

    // Click the Désactiver button
    await page.locator(`[data-testid="seller-toggle-status-btn-${productId}"]`).click();

    // === VÉRIFICATION UI ===
    // Status badge should now say "Inactif"
    await expect(statusBadge).toHaveText('Inactif');
  });

  test('after deactivation, toggle button text changes to "Activer"', async ({ page }) => {
    // === SETUP ===
    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);

    const productId = await createProductForSeller(page, token, {
      name: 'E2E-24-Deactivate-BtnText',
      price: 29.99,
      stock_quantity: 5,
      is_active: true,
    });

    // === ACTION ===
    await page.goto('/seller/dashboard');

    // Before toggle: button says "Désactiver"
    const toggleBtn = page.locator(`[data-testid="seller-toggle-status-btn-${productId}"]`);
    await expect(toggleBtn).toContainText(/désactiver/i);

    // Click to deactivate
    await toggleBtn.click();

    // === VÉRIFICATION UI ===
    // Button text should now say "Activer"
    await expect(toggleBtn).toContainText(/activer/i);
  });

  test('deactivation shows feedback toast with deactivation message', async ({ page }) => {
    // === SETUP ===
    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);

    const productId = await createProductForSeller(page, token, {
      name: 'E2E-24-Deactivate-Toast',
      price: 19.99,
      stock_quantity: 8,
      is_active: true,
    });

    // === ACTION ===
    await page.goto('/seller/dashboard');
    await page.locator(`[data-testid="seller-toggle-status-btn-${productId}"]`).click();

    // === VÉRIFICATION UI ===
    // Feedback toast should appear
    const toast = page.locator('[data-testid="toggle-status-feedback"]');
    await expect(toast).toBeVisible();

    // Toast message should mention the product is now inactive/hidden
    const toastMessage = page.locator('[data-testid="toggle-status-feedback-message"]');
    await expect(toastMessage).toContainText(/inactif|masqué|désactivé/i);
    await expect(toastMessage).toContainText('E2E-24-Deactivate-Toast');
  });

  test('deactivation updates stats (active count decreases, inactive count increases)', async ({ page }) => {
    // === SETUP: clean slate for predictable counts ===
    const vendeur = await db.findOne('users', { email: VENDEUR_EMAIL });
    expect(vendeur).toBeTruthy();
    await db.query('DELETE FROM products WHERE user_id = ?', [vendeur!.id]);

    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);

    // Create 2 active, 1 inactive
    const productToDeactivate = await createProductForSeller(page, token, {
      name: 'E2E-24-Stats-ToDeactivate',
      price: 10,
      stock_quantity: 5,
      is_active: true,
    });
    await createProductForSeller(page, token, {
      name: 'E2E-24-Stats-StayActive',
      price: 20,
      stock_quantity: 10,
      is_active: true,
    });
    await createProductForSeller(page, token, {
      name: 'E2E-24-Stats-AlreadyInactive',
      price: 30,
      stock_quantity: 0,
      is_active: false,
    });

    // === ACTION ===
    await page.goto('/seller/dashboard');

    // Verify initial stats: 3 total, 2 active, 1 inactive
    await expect(page.locator('[data-testid="seller-stat-total-products"]')).toHaveText('3');
    await expect(page.locator('[data-testid="seller-stat-active-products"]')).toHaveText('2');
    await expect(page.locator('[data-testid="seller-stat-inactive-products"]')).toHaveText('1');

    // Deactivate the first product
    await page.locator(`[data-testid="seller-toggle-status-btn-${productToDeactivate}"]`).click();

    // === VÉRIFICATION UI ===
    // Stats should update: total stays 3, active → 1, inactive → 2
    await expect(page.locator('[data-testid="seller-stat-total-products"]')).toHaveText('3');
    await expect(page.locator('[data-testid="seller-stat-active-products"]')).toHaveText('1');
    await expect(page.locator('[data-testid="seller-stat-inactive-products"]')).toHaveText('2');
  });

  test('deactivation persists is_active=false in database', async ({ page }) => {
    // === SETUP ===
    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);

    const productId = await createProductForSeller(page, token, {
      name: 'E2E-24-Deactivate-DB',
      price: 39.99,
      stock_quantity: 15,
      is_active: true,
    });

    // Verify initially active in DB
    const beforeProduct = await db.findOne('products', { id: productId });
    expect(beforeProduct).toBeTruthy();
    expect(beforeProduct!.is_active).toBeTruthy();

    // === ACTION ===
    await page.goto('/seller/dashboard');
    await page.locator(`[data-testid="seller-toggle-status-btn-${productId}"]`).click();

    // Wait for UI update to confirm the action happened
    await expect(
      page.locator(`[data-testid="seller-product-status-${productId}"]`)
    ).toHaveText('Inactif');

    // === VÉRIFICATION DB ===
    const afterProduct = await db.findOne('products', { id: productId });
    expect(afterProduct).toBeTruthy();
    expect(afterProduct!.is_active).toBeFalsy();
  });

  test('deactivated product is no longer visible in public catalogue', async ({ page }) => {
    // === SETUP ===
    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);

    const productId = await createProductForSeller(page, token, {
      name: 'E2E-24-Deactivate-Catalogue',
      price: 59.99,
      stock_quantity: 20,
      is_active: true,
    });

    // Verify product appears in public catalogue while active
    const catalogueBeforeResponse = await page.request.get(`${API_URL}/products`, {
      headers: { Accept: 'application/json' },
    });
    expect(catalogueBeforeResponse.status()).toBe(200);
    const catalogueBefore = await catalogueBeforeResponse.json();
    const visibleBefore = catalogueBefore.data.find((p: any) => p.id === productId);
    expect(visibleBefore).toBeDefined();

    // === ACTION: deactivate via toggle API ===
    const toggleResponse = await page.request.patch(
      `${API_URL}/seller/products/${productId}/toggle-status`,
      {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      }
    );
    expect(toggleResponse.status()).toBe(200);

    // === VÉRIFICATION: product should NOT appear in public catalogue ===
    const catalogueAfterResponse = await page.request.get(`${API_URL}/products`, {
      headers: { Accept: 'application/json' },
    });
    expect(catalogueAfterResponse.status()).toBe(200);
    const catalogueAfter = await catalogueAfterResponse.json();
    const visibleAfter = catalogueAfter.data.find((p: any) => p.id === productId);
    expect(visibleAfter).toBeUndefined();
  });
});

// ===========================================================================
// AC2 — ACTIVATE: Inactive → Active via UI
// ===========================================================================

test.describe('Story 2.4 — AC2: Activate an inactive product', () => {
  test('clicking "Activer" on an inactive product changes status badge to "Actif"', async ({ page }) => {
    // === SETUP ===
    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);

    const productId = await createProductForSeller(page, token, {
      name: 'E2E-24-Activate-Badge',
      price: 34.99,
      stock_quantity: 0,
      is_active: false,
    });

    // === ACTION: navigate to dashboard and click Activer ===
    await page.goto('/seller/dashboard');

    // Verify product is initially inactive
    const statusBadge = page.locator(`[data-testid="seller-product-status-${productId}"]`);
    await expect(statusBadge).toHaveText('Inactif');

    // Click the Activer button
    await page.locator(`[data-testid="seller-toggle-status-btn-${productId}"]`).click();

    // === VÉRIFICATION UI ===
    // Status badge should now say "Actif"
    await expect(statusBadge).toHaveText('Actif');
  });

  test('after activation, toggle button text changes to "Désactiver"', async ({ page }) => {
    // === SETUP ===
    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);

    const productId = await createProductForSeller(page, token, {
      name: 'E2E-24-Activate-BtnText',
      price: 24.99,
      stock_quantity: 3,
      is_active: false,
    });

    // === ACTION ===
    await page.goto('/seller/dashboard');

    // Before toggle: button says "Activer"
    const toggleBtn = page.locator(`[data-testid="seller-toggle-status-btn-${productId}"]`);
    await expect(toggleBtn).toContainText(/activer/i);

    // Click to activate
    await toggleBtn.click();

    // === VÉRIFICATION UI ===
    // Button text should now say "Désactiver"
    await expect(toggleBtn).toContainText(/désactiver/i);
  });

  test('activation shows feedback toast with activation message', async ({ page }) => {
    // === SETUP ===
    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);

    const productId = await createProductForSeller(page, token, {
      name: 'E2E-24-Activate-Toast',
      price: 14.99,
      stock_quantity: 12,
      is_active: false,
    });

    // === ACTION ===
    await page.goto('/seller/dashboard');
    await page.locator(`[data-testid="seller-toggle-status-btn-${productId}"]`).click();

    // === VÉRIFICATION UI ===
    // Feedback toast should appear
    const toast = page.locator('[data-testid="toggle-status-feedback"]');
    await expect(toast).toBeVisible();

    // Toast message should mention the product is now active/visible
    const toastMessage = page.locator('[data-testid="toggle-status-feedback-message"]');
    await expect(toastMessage).toContainText(/actif|visible|activé/i);
    await expect(toastMessage).toContainText('E2E-24-Activate-Toast');
  });

  test('activation updates stats (inactive count decreases, active count increases)', async ({ page }) => {
    // === SETUP: clean slate for predictable counts ===
    const vendeur = await db.findOne('users', { email: VENDEUR_EMAIL });
    expect(vendeur).toBeTruthy();
    await db.query('DELETE FROM products WHERE user_id = ?', [vendeur!.id]);

    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);

    // Create 1 active, 2 inactive
    await createProductForSeller(page, token, {
      name: 'E2E-24-Stats-Active',
      price: 10,
      stock_quantity: 5,
      is_active: true,
    });
    const productToActivate = await createProductForSeller(page, token, {
      name: 'E2E-24-Stats-ToActivate',
      price: 20,
      stock_quantity: 0,
      is_active: false,
    });
    await createProductForSeller(page, token, {
      name: 'E2E-24-Stats-StayInactive',
      price: 30,
      stock_quantity: 0,
      is_active: false,
    });

    // === ACTION ===
    await page.goto('/seller/dashboard');

    // Verify initial stats: 3 total, 1 active, 2 inactive
    await expect(page.locator('[data-testid="seller-stat-total-products"]')).toHaveText('3');
    await expect(page.locator('[data-testid="seller-stat-active-products"]')).toHaveText('1');
    await expect(page.locator('[data-testid="seller-stat-inactive-products"]')).toHaveText('2');

    // Activate the inactive product
    await page.locator(`[data-testid="seller-toggle-status-btn-${productToActivate}"]`).click();

    // === VÉRIFICATION UI ===
    // Stats should update: total stays 3, active → 2, inactive → 1
    await expect(page.locator('[data-testid="seller-stat-total-products"]')).toHaveText('3');
    await expect(page.locator('[data-testid="seller-stat-active-products"]')).toHaveText('2');
    await expect(page.locator('[data-testid="seller-stat-inactive-products"]')).toHaveText('1');
  });

  test('activation persists is_active=true in database', async ({ page }) => {
    // === SETUP ===
    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);

    const productId = await createProductForSeller(page, token, {
      name: 'E2E-24-Activate-DB',
      price: 44.99,
      stock_quantity: 7,
      is_active: false,
    });

    // Verify initially inactive in DB
    const beforeProduct = await db.findOne('products', { id: productId });
    expect(beforeProduct).toBeTruthy();
    expect(beforeProduct!.is_active).toBeFalsy();

    // === ACTION ===
    await page.goto('/seller/dashboard');
    await page.locator(`[data-testid="seller-toggle-status-btn-${productId}"]`).click();

    // Wait for UI update to confirm the action happened
    await expect(
      page.locator(`[data-testid="seller-product-status-${productId}"]`)
    ).toHaveText('Actif');

    // === VÉRIFICATION DB ===
    const afterProduct = await db.findOne('products', { id: productId });
    expect(afterProduct).toBeTruthy();
    expect(afterProduct!.is_active).toBeTruthy();
  });

  test('activated product becomes visible in public catalogue', async ({ page }) => {
    // === SETUP ===
    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);

    const productId = await createProductForSeller(page, token, {
      name: 'E2E-24-Activate-Catalogue',
      price: 69.99,
      stock_quantity: 30,
      is_active: false,
    });

    // Verify product does NOT appear in public catalogue while inactive
    const catalogueBeforeResponse = await page.request.get(`${API_URL}/products`, {
      headers: { Accept: 'application/json' },
    });
    expect(catalogueBeforeResponse.status()).toBe(200);
    const catalogueBefore = await catalogueBeforeResponse.json();
    const visibleBefore = catalogueBefore.data.find((p: any) => p.id === productId);
    expect(visibleBefore).toBeUndefined();

    // === ACTION: activate via toggle API ===
    const toggleResponse = await page.request.patch(
      `${API_URL}/seller/products/${productId}/toggle-status`,
      {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      }
    );
    expect(toggleResponse.status()).toBe(200);

    // === VÉRIFICATION: product should now appear in public catalogue ===
    const catalogueAfterResponse = await page.request.get(`${API_URL}/products`, {
      headers: { Accept: 'application/json' },
    });
    expect(catalogueAfterResponse.status()).toBe(200);
    const catalogueAfter = await catalogueAfterResponse.json();
    const visibleAfter = catalogueAfter.data.find((p: any) => p.id === productId);
    expect(visibleAfter).toBeDefined();
  });
});

// ===========================================================================
// BACKEND API — PATCH /api/seller/products/{id}/toggle-status
// ===========================================================================

test.describe('Story 2.4 — Backend API: PATCH /api/seller/products/{id}/toggle-status', () => {
  test('API returns 200 and toggles active→inactive', async ({ page }) => {
    // === SETUP ===
    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);

    const productId = await createProductForSeller(page, token, {
      name: 'E2E-24-API-Active2Inactive',
      price: 25,
      stock_quantity: 10,
      is_active: true,
    });

    // === ACTION: toggle status ===
    const response = await page.request.patch(
      `${API_URL}/seller/products/${productId}/toggle-status`,
      {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      }
    );

    // === VÉRIFICATION ===
    expect(response.status()).toBe(200);

    const json = await response.json();
    expect(json.data).toBeDefined();
    expect(json.data.id).toBe(productId);
    expect(json.data.is_active).toBe(false);
  });

  test('API returns 200 and toggles inactive→active', async ({ page }) => {
    // === SETUP ===
    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);

    const productId = await createProductForSeller(page, token, {
      name: 'E2E-24-API-Inactive2Active',
      price: 35,
      stock_quantity: 0,
      is_active: false,
    });

    // === ACTION: toggle status ===
    const response = await page.request.patch(
      `${API_URL}/seller/products/${productId}/toggle-status`,
      {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      }
    );

    // === VÉRIFICATION ===
    expect(response.status()).toBe(200);

    const json = await response.json();
    expect(json.data).toBeDefined();
    expect(json.data.id).toBe(productId);
    expect(json.data.is_active).toBe(true);
  });

  test('API returns updated ProductResource with all required fields', async ({ page }) => {
    // === SETUP ===
    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);

    const productId = await createProductForSeller(page, token, {
      name: 'E2E-24-API-Resource',
      price: 42.50,
      stock_quantity: 8,
      is_active: true,
    });

    // === ACTION ===
    const response = await page.request.patch(
      `${API_URL}/seller/products/${productId}/toggle-status`,
      {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      }
    );

    // === VÉRIFICATION ===
    expect(response.status()).toBe(200);

    const json = await response.json();
    const product = json.data;

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

    // Values preserved (only is_active changed)
    expect(product.name).toBe('E2E-24-API-Resource');
    expect(product.price).toBeCloseTo(42.50, 2);
    expect(product.stock_quantity).toBe(8);
  });

  test('double toggle returns product to original state', async ({ page }) => {
    // === SETUP ===
    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);

    const productId = await createProductForSeller(page, token, {
      name: 'E2E-24-DoubleToggle',
      price: 55,
      stock_quantity: 12,
      is_active: true,
    });

    // === ACTION: first toggle (active → inactive) ===
    const response1 = await page.request.patch(
      `${API_URL}/seller/products/${productId}/toggle-status`,
      {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      }
    );
    expect(response1.status()).toBe(200);
    const json1 = await response1.json();
    expect(json1.data.is_active).toBe(false);

    // === ACTION: second toggle (inactive → active) ===
    const response2 = await page.request.patch(
      `${API_URL}/seller/products/${productId}/toggle-status`,
      {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      }
    );
    expect(response2.status()).toBe(200);
    const json2 = await response2.json();
    expect(json2.data.is_active).toBe(true);

    // === VÉRIFICATION DB: back to original state ===
    const dbProduct = await db.findOne('products', { id: productId });
    expect(dbProduct).toBeTruthy();
    expect(dbProduct!.is_active).toBeTruthy();
  });

  test('API returns 401 for unauthenticated toggle request', async ({ page }) => {
    // === SETUP: create a product first ===
    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);

    const productId = await createProductForSeller(page, token, {
      name: 'E2E-24-Unauth',
      price: 10,
      stock_quantity: 5,
      is_active: true,
    });

    // === ACTION: toggle without auth ===
    const response = await page.request.patch(
      `${API_URL}/seller/products/${productId}/toggle-status`,
      {
        headers: { Accept: 'application/json' },
      }
    );

    // === VÉRIFICATION ===
    expect(response.status()).toBe(401);

    // Verify product was NOT toggled in DB
    const dbProduct = await db.findOne('products', { id: productId });
    expect(dbProduct).toBeTruthy();
    expect(dbProduct!.is_active).toBeTruthy();
  });

  test('API returns 403 for acheteur trying to toggle product', async ({ page }) => {
    // === SETUP: create product as vendeur, try toggle as acheteur ===
    const { token: vendeurToken } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);

    const productId = await createProductForSeller(page, vendeurToken, {
      name: 'E2E-24-Acheteur-Forbidden',
      price: 15,
      stock_quantity: 3,
      is_active: true,
    });

    const { token: acheteurToken } = await loginAs(page, ACHETEUR_EMAIL, ACHETEUR_PASSWORD);

    // === ACTION: acheteur tries to toggle ===
    const response = await page.request.patch(
      `${API_URL}/seller/products/${productId}/toggle-status`,
      {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${acheteurToken}`,
        },
      }
    );

    // === VÉRIFICATION ===
    expect(response.status()).toBe(403);

    // Verify product was NOT toggled in DB
    const dbProduct = await db.findOne('products', { id: productId });
    expect(dbProduct).toBeTruthy();
    expect(dbProduct!.is_active).toBeTruthy();
  });

  test('API returns 404 for non-existent product toggle', async ({ page }) => {
    // === SETUP ===
    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);

    // === ACTION: toggle a product ID that doesn't exist ===
    const response = await page.request.patch(
      `${API_URL}/seller/products/999999/toggle-status`,
      {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      }
    );

    // === VÉRIFICATION ===
    // Should return 404 (or 403 — both are acceptable to hide existence)
    expect([403, 404]).toContain(response.status());
  });
});

// ===========================================================================
// OWNERSHIP — Seller can only toggle their own products
// ===========================================================================

test.describe('Story 2.4 — Ownership: seller cannot toggle another seller\'s products', () => {
  test('vendeur2 cannot toggle vendeur1 product via API (403)', async ({ page }) => {
    // === SETUP ===
    const { token: token1 } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);

    const productId = await createProductForSeller(page, token1, {
      name: 'E2E-24-Ownership-V1',
      price: 100,
      stock_quantity: 50,
      is_active: true,
    });

    const { token: token2 } = await loginAs(page, VENDEUR2_EMAIL, VENDEUR2_PASSWORD);

    // === ACTION: vendeur2 tries to toggle vendeur1's product ===
    const response = await page.request.patch(
      `${API_URL}/seller/products/${productId}/toggle-status`,
      {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token2}`,
        },
      }
    );

    // === VÉRIFICATION ===
    // Should return 403 (forbidden) — scoped to authenticated seller
    expect([403, 404]).toContain(response.status());

    // === VÉRIFICATION DB: product status unchanged ===
    const dbProduct = await db.findOne('products', { id: productId });
    expect(dbProduct).toBeTruthy();
    expect(dbProduct!.is_active).toBeTruthy();
  });

  test('vendeur1 cannot toggle vendeur2 product via API (403)', async ({ page }) => {
    // === SETUP ===
    const { token: token2 } = await loginAs(page, VENDEUR2_EMAIL, VENDEUR2_PASSWORD);

    const productId = await createProductForSeller(page, token2, {
      name: 'E2E-24-Ownership-V2',
      price: 75,
      stock_quantity: 20,
      is_active: false,
    });

    const { token: token1 } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);

    // === ACTION: vendeur1 tries to toggle vendeur2's product ===
    const response = await page.request.patch(
      `${API_URL}/seller/products/${productId}/toggle-status`,
      {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token1}`,
        },
      }
    );

    // === VÉRIFICATION ===
    expect([403, 404]).toContain(response.status());

    // === VÉRIFICATION DB: product status unchanged ===
    const dbProduct = await db.findOne('products', { id: productId });
    expect(dbProduct).toBeTruthy();
    expect(dbProduct!.is_active).toBeFalsy();
  });
});

// ===========================================================================
// DB VERIFICATION — Toggle correctly updates database
// ===========================================================================

test.describe('Story 2.4 — DB verification: toggle status persistence', () => {
  test('toggle preserves all other product fields (name, price, stock, etc.)', async ({ page }) => {
    // === SETUP ===
    const { token, userId } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);

    const productId = await createProductForSeller(page, token, {
      name: 'E2E-24-DB-Preserve',
      price: 88.88,
      stock_quantity: 42,
      is_active: true,
    });

    // Capture all fields before toggle
    const beforeProduct = await db.findOne('products', { id: productId });
    expect(beforeProduct).toBeTruthy();

    // === ACTION: toggle via API ===
    const response = await page.request.patch(
      `${API_URL}/seller/products/${productId}/toggle-status`,
      {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      }
    );
    expect(response.status()).toBe(200);

    // === VÉRIFICATION DB ===
    const afterProduct = await db.findOne('products', { id: productId });
    expect(afterProduct).toBeTruthy();

    // is_active should be toggled
    expect(afterProduct!.is_active).toBeFalsy();

    // All other fields should be unchanged
    expect(afterProduct!.name).toBe(beforeProduct!.name);
    expect(Number(afterProduct!.price)).toBeCloseTo(Number(beforeProduct!.price), 2);
    expect(afterProduct!.stock_quantity).toBe(beforeProduct!.stock_quantity);
    expect(afterProduct!.user_id).toBe(beforeProduct!.user_id);
    expect(afterProduct!.user_id).toBe(userId);
  });

  test('toggle updates updated_at timestamp', async ({ page }) => {
    // === SETUP ===
    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);

    const productId = await createProductForSeller(page, token, {
      name: 'E2E-24-DB-Timestamp',
      price: 15,
      stock_quantity: 5,
      is_active: true,
    });

    const beforeProduct = await db.findOne('products', { id: productId });
    expect(beforeProduct).toBeTruthy();
    const beforeTimestamp = new Date(beforeProduct!.updated_at).getTime();

    // Small delay to ensure timestamp difference
    await new Promise((resolve) => setTimeout(resolve, 1100));

    // === ACTION: toggle via API ===
    const response = await page.request.patch(
      `${API_URL}/seller/products/${productId}/toggle-status`,
      {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      }
    );
    expect(response.status()).toBe(200);

    // === VÉRIFICATION DB ===
    const afterProduct = await db.findOne('products', { id: productId });
    expect(afterProduct).toBeTruthy();
    const afterTimestamp = new Date(afterProduct!.updated_at).getTime();

    // updated_at should be more recent
    expect(afterTimestamp).toBeGreaterThan(beforeTimestamp);
  });

  test('toggle does not create orphan records or affect foreign keys', async ({ page }) => {
    // === SETUP ===
    const { token, userId } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);

    const productId = await createProductForSeller(page, token, {
      name: 'E2E-24-DB-FK',
      price: 20,
      stock_quantity: 10,
      is_active: true,
    });

    // === ACTION ===
    const response = await page.request.patch(
      `${API_URL}/seller/products/${productId}/toggle-status`,
      {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      }
    );
    expect(response.status()).toBe(200);

    // === VÉRIFICATION DB ===
    // Product still exists
    const product = await db.assertExists('products', { id: productId });

    // Foreign key still valid — user exists
    const user = await db.findOne('users', { id: product.user_id });
    expect(user).toBeTruthy();
    expect(user!.id).toBe(userId);
    expect(user!.role).toBe('vendeur');

    // No duplicate products created
    const productCount = await db.count('products', { id: productId });
    expect(productCount).toBe(1);
  });
});

// ===========================================================================
// UI — FEEDBACK TOAST BEHAVIOR
// ===========================================================================

test.describe('Story 2.4 — UI: Toggle feedback toast behavior', () => {
  test('feedback toast can be manually dismissed', async ({ page }) => {
    // === SETUP ===
    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);

    const productId = await createProductForSeller(page, token, {
      name: 'E2E-24-Toast-Dismiss',
      price: 12,
      stock_quantity: 5,
      is_active: true,
    });

    // === ACTION ===
    await page.goto('/seller/dashboard');
    await page.locator(`[data-testid="seller-toggle-status-btn-${productId}"]`).click();

    // Toast should appear
    await expect(page.locator('[data-testid="toggle-status-feedback"]')).toBeVisible();

    // Click dismiss button
    await page.locator('[data-testid="toggle-status-feedback-dismiss-btn"]').click();

    // === VÉRIFICATION UI ===
    // Toast should disappear
    await expect(page.locator('[data-testid="toggle-status-feedback"]')).not.toBeVisible();
  });

  test('feedback toast auto-dismisses after a few seconds', async ({ page }) => {
    // === SETUP ===
    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);

    const productId = await createProductForSeller(page, token, {
      name: 'E2E-24-Toast-AutoDismiss',
      price: 18,
      stock_quantity: 4,
      is_active: true,
    });

    // === ACTION ===
    await page.goto('/seller/dashboard');
    await page.locator(`[data-testid="seller-toggle-status-btn-${productId}"]`).click();

    // Toast should appear
    await expect(page.locator('[data-testid="toggle-status-feedback"]')).toBeVisible();

    // === VÉRIFICATION UI ===
    // Toast should auto-dismiss (within ~4 seconds to account for animation)
    await expect(page.locator('[data-testid="toggle-status-feedback"]')).not.toBeVisible({
      timeout: 5_000,
    });
  });

  test('toggling a second product replaces the previous toast message', async ({ page }) => {
    // === SETUP ===
    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);

    const product1 = await createProductForSeller(page, token, {
      name: 'E2E-24-Toast-Replace-1',
      price: 10,
      stock_quantity: 5,
      is_active: true,
    });
    const product2 = await createProductForSeller(page, token, {
      name: 'E2E-24-Toast-Replace-2',
      price: 20,
      stock_quantity: 10,
      is_active: true,
    });

    // === ACTION ===
    await page.goto('/seller/dashboard');

    // Toggle first product
    await page.locator(`[data-testid="seller-toggle-status-btn-${product1}"]`).click();

    const toastMessage = page.locator('[data-testid="toggle-status-feedback-message"]');
    await expect(toastMessage).toContainText('E2E-24-Toast-Replace-1');

    // Toggle second product
    await page.locator(`[data-testid="seller-toggle-status-btn-${product2}"]`).click();

    // === VÉRIFICATION UI ===
    // Toast should now show second product name
    await expect(toastMessage).toContainText('E2E-24-Toast-Replace-2');
  });
});

// ===========================================================================
// UI — DOUBLE TOGGLE IN SAME SESSION (reversibility)
// ===========================================================================

test.describe('Story 2.4 — UI: Double toggle reversibility', () => {
  test('double-clicking toggle in UI returns product to original active state', async ({ page }) => {
    // === SETUP ===
    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);

    const productId = await createProductForSeller(page, token, {
      name: 'E2E-24-UI-DoubleToggle',
      price: 33,
      stock_quantity: 8,
      is_active: true,
    });

    // === ACTION ===
    await page.goto('/seller/dashboard');

    const statusBadge = page.locator(`[data-testid="seller-product-status-${productId}"]`);
    const toggleBtn = page.locator(`[data-testid="seller-toggle-status-btn-${productId}"]`);

    // Initially active
    await expect(statusBadge).toHaveText('Actif');

    // First toggle: active → inactive
    await toggleBtn.click();
    await expect(statusBadge).toHaveText('Inactif');

    // Second toggle: inactive → active
    await toggleBtn.click();

    // === VÉRIFICATION UI ===
    await expect(statusBadge).toHaveText('Actif');
    await expect(toggleBtn).toContainText(/désactiver/i);
  });
});

// ===========================================================================
// ROLE PROTECTION — Only vendeur can use toggle
// ===========================================================================

test.describe('Story 2.4 — Role protection: only vendeur can toggle products', () => {
  test('admin cannot toggle product status via API', async ({ page }) => {
    // === SETUP ===
    const { token: vendeurToken } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);

    const productId = await createProductForSeller(page, vendeurToken, {
      name: 'E2E-24-Admin-NoToggle',
      price: 50,
      stock_quantity: 10,
      is_active: true,
    });

    const { token: adminToken } = await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);

    // === ACTION: admin tries to toggle ===
    const response = await page.request.patch(
      `${API_URL}/seller/products/${productId}/toggle-status`,
      {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
      }
    );

    // === VÉRIFICATION ===
    expect(response.status()).toBe(403);

    // Product status unchanged
    const dbProduct = await db.findOne('products', { id: productId });
    expect(dbProduct).toBeTruthy();
    expect(dbProduct!.is_active).toBeTruthy();
  });
});
