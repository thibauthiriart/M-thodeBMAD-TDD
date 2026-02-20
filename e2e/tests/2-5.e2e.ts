import { test, expect, Page } from '@playwright/test';
import { loginAs, logout } from '../helpers/auth';
import { db } from '../helpers/database';

/**
 * Story 2.5 — Delete Product
 *
 * AC1: Given a seller clicks "Delete" on one of their products
 *      When a confirmation dialog appears and they confirm
 *      Then the product is permanently removed from the system
 *
 * AC2: Given a seller clicks "Delete" and cancels the confirmation
 *      When the dialog is dismissed
 *      Then the product remains unchanged
 *
 * Pre-conditions:
 * - e2e-vendeur@test.com / password exists with role "vendeur" (from E2ETestSeeder)
 * - e2e@test.com / password exists with role "acheteur" (from E2ETestSeeder)
 * - e2e-admin@test.com / password exists with role "admin" (from E2ETestSeeder)
 *
 * The tests describe EXPECTED behavior (TDD). They will fail until:
 * - Backend: SellerProductController@destroy (DELETE /api/seller/products/{id}) implemented
 * - Backend: Scoped to authenticated seller's products
 * - Backend: Delete associated photo from storage
 * - Backend: Return 204 No Content
 * - Frontend: Delete button opens confirmation dialog
 * - Frontend: Confirm → calls API, removes product from store
 * - Frontend: Cancel → closes dialog, product unchanged
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
const VENDEUR2_EMAIL = `e2e-vendeur2-25-${Date.now()}@test.com`;
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
      name: 'E2E Vendeur2 Story25',
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
  await db.query('DELETE FROM products WHERE name LIKE ?', ['E2E-25-%']);
  // Cleanup vendeur2 test user
  await db.query('DELETE FROM users WHERE email = ?', [VENDEUR2_EMAIL]);
  await db.cleanup();
});

// ===========================================================================
// AC1 — DELETE WITH CONFIRMATION: Confirm → product permanently removed
// ===========================================================================

test.describe('Story 2.5 — AC1: Delete product with confirmation', () => {
  test('clicking "Supprimer" opens a confirmation dialog', async ({ page }) => {
    // === SETUP ===
    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);

    const productId = await createProductForSeller(page, token, {
      name: 'E2E-25-Dialog-Open',
      price: 29.99,
      stock_quantity: 10,
      is_active: true,
    });

    // === ACTION: navigate to dashboard and click delete ===
    await page.goto('/seller/dashboard');

    // Verify product is visible
    await expect(
      page.locator(`[data-testid="seller-product-row-${productId}"]`)
    ).toBeVisible();

    // Click delete button
    await page.locator(`[data-testid="seller-delete-product-btn-${productId}"]`).click();

    // === VÉRIFICATION UI ===
    // Confirmation dialog should be visible
    const dialog = page.locator('[data-testid="confirm-dialog"]');
    await expect(dialog).toBeVisible();

    // Dialog should have a title
    await expect(page.locator('[data-testid="confirm-dialog-title"]')).toBeVisible();

    // Dialog should mention the product name in the message
    await expect(page.locator('[data-testid="confirm-dialog-message"]')).toContainText(
      'E2E-25-Dialog-Open'
    );

    // Dialog should have confirm and cancel buttons
    await expect(page.locator('[data-testid="confirm-dialog-confirm-btn"]')).toBeVisible();
    await expect(page.locator('[data-testid="confirm-dialog-cancel-btn"]')).toBeVisible();
  });

  test('confirming deletion removes the product from the dashboard list', async ({ page }) => {
    // === SETUP ===
    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);

    const productId = await createProductForSeller(page, token, {
      name: 'E2E-25-Confirm-Remove-UI',
      price: 19.99,
      stock_quantity: 5,
      is_active: true,
    });

    // === ACTION ===
    await page.goto('/seller/dashboard');

    // Verify product is visible before deletion
    const productRow = page.locator(`[data-testid="seller-product-row-${productId}"]`);
    await expect(productRow).toBeVisible();

    // Click delete
    await page.locator(`[data-testid="seller-delete-product-btn-${productId}"]`).click();

    // Confirm deletion
    await page.locator('[data-testid="confirm-dialog-confirm-btn"]').click();

    // === VÉRIFICATION UI ===
    // Product row should no longer be visible in the dashboard
    await expect(productRow).not.toBeVisible();

    // Dialog should be closed
    await expect(page.locator('[data-testid="confirm-dialog"]')).not.toBeVisible();
  });

  test('confirming deletion shows a success feedback toast', async ({ page }) => {
    // === SETUP ===
    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);

    const productId = await createProductForSeller(page, token, {
      name: 'E2E-25-Confirm-Toast',
      price: 14.99,
      stock_quantity: 3,
      is_active: true,
    });

    // === ACTION ===
    await page.goto('/seller/dashboard');
    await page.locator(`[data-testid="seller-delete-product-btn-${productId}"]`).click();
    await page.locator('[data-testid="confirm-dialog-confirm-btn"]').click();

    // === VÉRIFICATION UI ===
    // Feedback toast should appear
    const toast = page.locator('[data-testid="delete-feedback"]');
    await expect(toast).toBeVisible();

    // Toast message should mention the deleted product
    const toastMessage = page.locator('[data-testid="delete-feedback-message"]');
    await expect(toastMessage).toContainText('E2E-25-Confirm-Toast');
  });

  test('confirming deletion permanently removes the product from database', async ({ page }) => {
    // === SETUP ===
    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);

    const productId = await createProductForSeller(page, token, {
      name: 'E2E-25-Confirm-DB',
      price: 39.99,
      stock_quantity: 15,
      is_active: true,
    });

    // Verify product exists in DB before deletion
    const beforeProduct = await db.assertExists('products', { id: productId });
    expect(beforeProduct.name).toBe('E2E-25-Confirm-DB');

    // === ACTION ===
    await page.goto('/seller/dashboard');
    await page.locator(`[data-testid="seller-delete-product-btn-${productId}"]`).click();
    await page.locator('[data-testid="confirm-dialog-confirm-btn"]').click();

    // Wait for UI confirmation that the delete happened
    await expect(
      page.locator(`[data-testid="seller-product-row-${productId}"]`)
    ).not.toBeVisible();

    // === VÉRIFICATION DB ===
    // Product should no longer exist in database (hard delete, no soft delete)
    await db.assertNotExists('products', { id: productId });
  });

  test('deletion updates stats (total count decreases)', async ({ page }) => {
    // === SETUP: clean slate for predictable counts ===
    const vendeur = await db.findOne('users', { email: VENDEUR_EMAIL });
    expect(vendeur).toBeTruthy();
    await db.query('DELETE FROM products WHERE user_id = ?', [vendeur!.id]);

    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);

    // Create 3 products: 2 active, 1 inactive
    const productToDelete = await createProductForSeller(page, token, {
      name: 'E2E-25-Stats-ToDelete',
      price: 10,
      stock_quantity: 5,
      is_active: true,
    });
    await createProductForSeller(page, token, {
      name: 'E2E-25-Stats-Stay1',
      price: 20,
      stock_quantity: 10,
      is_active: true,
    });
    await createProductForSeller(page, token, {
      name: 'E2E-25-Stats-Stay2',
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

    // Delete the first product (active)
    await page.locator(`[data-testid="seller-delete-product-btn-${productToDelete}"]`).click();
    await page.locator('[data-testid="confirm-dialog-confirm-btn"]').click();

    // === VÉRIFICATION UI ===
    // Stats should update: total → 2, active → 1, inactive stays 1
    await expect(page.locator('[data-testid="seller-stat-total-products"]')).toHaveText('2');
    await expect(page.locator('[data-testid="seller-stat-active-products"]')).toHaveText('1');
    await expect(page.locator('[data-testid="seller-stat-inactive-products"]')).toHaveText('1');
  });

  test('deleting the last product shows the empty state', async ({ page }) => {
    // === SETUP: clean slate ===
    const vendeur = await db.findOne('users', { email: VENDEUR_EMAIL });
    expect(vendeur).toBeTruthy();
    await db.query('DELETE FROM products WHERE user_id = ?', [vendeur!.id]);

    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);

    // Create a single product
    const productId = await createProductForSeller(page, token, {
      name: 'E2E-25-LastProduct',
      price: 15,
      stock_quantity: 1,
      is_active: true,
    });

    // === ACTION ===
    await page.goto('/seller/dashboard');

    // Verify product is visible and no empty state
    await expect(
      page.locator(`[data-testid="seller-product-row-${productId}"]`)
    ).toBeVisible();
    await expect(page.locator('[data-testid="seller-empty-state"]')).not.toBeVisible();

    // Delete the only product
    await page.locator(`[data-testid="seller-delete-product-btn-${productId}"]`).click();
    await page.locator('[data-testid="confirm-dialog-confirm-btn"]').click();

    // === VÉRIFICATION UI ===
    // Empty state should appear
    await expect(page.locator('[data-testid="seller-empty-state"]')).toBeVisible();
    await expect(page.locator('[data-testid="seller-empty-state-title"]')).toBeVisible();
  });
});

// ===========================================================================
// AC2 — CANCEL: Cancel → product remains unchanged
// ===========================================================================

test.describe('Story 2.5 — AC2: Cancel deletion keeps product unchanged', () => {
  test('clicking "Annuler" in confirmation dialog closes it and keeps the product', async ({ page }) => {
    // === SETUP ===
    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);

    const productId = await createProductForSeller(page, token, {
      name: 'E2E-25-Cancel-Keep',
      price: 49.99,
      stock_quantity: 20,
      is_active: true,
    });

    // === ACTION ===
    await page.goto('/seller/dashboard');

    // Click delete to open dialog
    await page.locator(`[data-testid="seller-delete-product-btn-${productId}"]`).click();
    await expect(page.locator('[data-testid="confirm-dialog"]')).toBeVisible();

    // Click cancel
    await page.locator('[data-testid="confirm-dialog-cancel-btn"]').click();

    // === VÉRIFICATION UI ===
    // Dialog should be closed
    await expect(page.locator('[data-testid="confirm-dialog"]')).not.toBeVisible();

    // Product should still be visible in the dashboard
    await expect(
      page.locator(`[data-testid="seller-product-row-${productId}"]`)
    ).toBeVisible();

    // Product name should still be displayed
    await expect(
      page.locator(`[data-testid="seller-product-name-${productId}"]`)
    ).toHaveText('E2E-25-Cancel-Keep');
  });

  test('cancelling deletion does not modify the product in database', async ({ page }) => {
    // === SETUP ===
    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);

    const productId = await createProductForSeller(page, token, {
      name: 'E2E-25-Cancel-DB',
      price: 59.99,
      stock_quantity: 25,
      is_active: true,
    });

    // Capture product state before cancel
    const beforeProduct = await db.assertExists('products', { id: productId });

    // === ACTION ===
    await page.goto('/seller/dashboard');
    await page.locator(`[data-testid="seller-delete-product-btn-${productId}"]`).click();
    await expect(page.locator('[data-testid="confirm-dialog"]')).toBeVisible();
    await page.locator('[data-testid="confirm-dialog-cancel-btn"]').click();

    // === VÉRIFICATION DB ===
    // Product should still exist with identical values
    const afterProduct = await db.assertExists('products', { id: productId });
    expect(afterProduct.name).toBe(beforeProduct.name);
    expect(Number(afterProduct.price)).toBeCloseTo(Number(beforeProduct.price), 2);
    expect(afterProduct.stock_quantity).toBe(beforeProduct.stock_quantity);
    expect(afterProduct.is_active).toBe(beforeProduct.is_active);
  });

  test('clicking backdrop closes dialog without deleting', async ({ page }) => {
    // === SETUP ===
    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);

    const productId = await createProductForSeller(page, token, {
      name: 'E2E-25-Backdrop-Close',
      price: 24.99,
      stock_quantity: 8,
      is_active: true,
    });

    // === ACTION ===
    await page.goto('/seller/dashboard');
    await page.locator(`[data-testid="seller-delete-product-btn-${productId}"]`).click();
    await expect(page.locator('[data-testid="confirm-dialog"]')).toBeVisible();

    // Click backdrop to dismiss
    await page.locator('[data-testid="confirm-dialog-backdrop"]').click();

    // === VÉRIFICATION UI ===
    // Dialog should be closed
    await expect(page.locator('[data-testid="confirm-dialog"]')).not.toBeVisible();

    // Product should still be visible
    await expect(
      page.locator(`[data-testid="seller-product-row-${productId}"]`)
    ).toBeVisible();

    // === VÉRIFICATION DB ===
    await db.assertExists('products', { id: productId });
  });

  test('cancelling deletion does not show feedback toast', async ({ page }) => {
    // === SETUP ===
    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);

    const productId = await createProductForSeller(page, token, {
      name: 'E2E-25-Cancel-NoToast',
      price: 9.99,
      stock_quantity: 2,
      is_active: true,
    });

    // === ACTION ===
    await page.goto('/seller/dashboard');
    await page.locator(`[data-testid="seller-delete-product-btn-${productId}"]`).click();
    await page.locator('[data-testid="confirm-dialog-cancel-btn"]').click();

    // === VÉRIFICATION UI ===
    // No delete feedback toast should appear
    await expect(page.locator('[data-testid="delete-feedback"]')).not.toBeVisible();
  });
});

// ===========================================================================
// BACKEND API — DELETE /api/seller/products/{id}
// ===========================================================================

test.describe('Story 2.5 — Backend API: DELETE /api/seller/products/{id}', () => {
  test('API returns 204 No Content on successful delete', async ({ page }) => {
    // === SETUP ===
    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);

    const productId = await createProductForSeller(page, token, {
      name: 'E2E-25-API-204',
      price: 25,
      stock_quantity: 10,
      is_active: true,
    });

    // === ACTION ===
    const response = await page.request.delete(
      `${API_URL}/seller/products/${productId}`,
      {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      }
    );

    // === VÉRIFICATION ===
    expect(response.status()).toBe(204);
  });

  test('deleted product no longer exists in database', async ({ page }) => {
    // === SETUP ===
    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);

    const productId = await createProductForSeller(page, token, {
      name: 'E2E-25-API-DB-Gone',
      price: 35,
      stock_quantity: 8,
      is_active: true,
    });

    // Verify it exists before
    await db.assertExists('products', { id: productId });

    // === ACTION ===
    const response = await page.request.delete(
      `${API_URL}/seller/products/${productId}`,
      {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      }
    );
    expect(response.status()).toBe(204);

    // === VÉRIFICATION DB ===
    await db.assertNotExists('products', { id: productId });
  });

  test('API returns 401 for unauthenticated delete request', async ({ page }) => {
    // === SETUP: create a product first ===
    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);

    const productId = await createProductForSeller(page, token, {
      name: 'E2E-25-API-Unauth',
      price: 10,
      stock_quantity: 5,
      is_active: true,
    });

    // === ACTION: delete without auth ===
    const response = await page.request.delete(
      `${API_URL}/seller/products/${productId}`,
      {
        headers: { Accept: 'application/json' },
      }
    );

    // === VÉRIFICATION ===
    expect(response.status()).toBe(401);

    // Verify product was NOT deleted in DB
    await db.assertExists('products', { id: productId });
  });

  test('API returns 403 for acheteur trying to delete product', async ({ page }) => {
    // === SETUP: create product as vendeur, try delete as acheteur ===
    const { token: vendeurToken } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);

    const productId = await createProductForSeller(page, vendeurToken, {
      name: 'E2E-25-API-Acheteur-Forbidden',
      price: 15,
      stock_quantity: 3,
      is_active: true,
    });

    const { token: acheteurToken } = await loginAs(page, ACHETEUR_EMAIL, ACHETEUR_PASSWORD);

    // === ACTION: acheteur tries to delete ===
    const response = await page.request.delete(
      `${API_URL}/seller/products/${productId}`,
      {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${acheteurToken}`,
        },
      }
    );

    // === VÉRIFICATION ===
    expect(response.status()).toBe(403);

    // Product must still exist
    await db.assertExists('products', { id: productId });
  });

  test('API returns 404 for non-existent product delete', async ({ page }) => {
    // === SETUP ===
    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);

    // === ACTION: delete a product ID that doesn't exist ===
    const response = await page.request.delete(
      `${API_URL}/seller/products/999999`,
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

  test('deleted product is no longer visible in public catalogue', async ({ page }) => {
    // === SETUP ===
    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);

    const productId = await createProductForSeller(page, token, {
      name: 'E2E-25-API-Catalogue',
      price: 45,
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

    // === ACTION: delete via API ===
    const deleteResponse = await page.request.delete(
      `${API_URL}/seller/products/${productId}`,
      {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      }
    );
    expect(deleteResponse.status()).toBe(204);

    // === VÉRIFICATION: product should NOT appear in public catalogue ===
    const catalogueAfterResponse = await page.request.get(`${API_URL}/products`, {
      headers: { Accept: 'application/json' },
    });
    expect(catalogueAfterResponse.status()).toBe(200);
    const catalogueAfter = await catalogueAfterResponse.json();
    const visibleAfter = catalogueAfter.data.find((p: any) => p.id === productId);
    expect(visibleAfter).toBeUndefined();
  });

  test('deleted product no longer appears in seller product list API', async ({ page }) => {
    // === SETUP ===
    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);

    const productId = await createProductForSeller(page, token, {
      name: 'E2E-25-API-SellerList',
      price: 22,
      stock_quantity: 6,
      is_active: true,
    });

    // Verify product appears in seller list before deletion
    const listBeforeResponse = await page.request.get(`${API_URL}/seller/products`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
    expect(listBeforeResponse.status()).toBe(200);
    const listBefore = await listBeforeResponse.json();
    const existsBefore = listBefore.data.find((p: any) => p.id === productId);
    expect(existsBefore).toBeDefined();

    // === ACTION ===
    const deleteResponse = await page.request.delete(
      `${API_URL}/seller/products/${productId}`,
      {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      }
    );
    expect(deleteResponse.status()).toBe(204);

    // === VÉRIFICATION ===
    const listAfterResponse = await page.request.get(`${API_URL}/seller/products`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
    expect(listAfterResponse.status()).toBe(200);
    const listAfter = await listAfterResponse.json();
    const existsAfter = listAfter.data.find((p: any) => p.id === productId);
    expect(existsAfter).toBeUndefined();
  });

  test('deleting a product twice returns 404 on the second attempt', async ({ page }) => {
    // === SETUP ===
    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);

    const productId = await createProductForSeller(page, token, {
      name: 'E2E-25-API-DoubleDel',
      price: 18,
      stock_quantity: 4,
      is_active: true,
    });

    // === ACTION: first delete ===
    const response1 = await page.request.delete(
      `${API_URL}/seller/products/${productId}`,
      {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      }
    );
    expect(response1.status()).toBe(204);

    // === ACTION: second delete (product already gone) ===
    const response2 = await page.request.delete(
      `${API_URL}/seller/products/${productId}`,
      {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      }
    );

    // === VÉRIFICATION ===
    expect([403, 404]).toContain(response2.status());
  });
});

// ===========================================================================
// OWNERSHIP — Seller can only delete their own products
// ===========================================================================

test.describe('Story 2.5 — Ownership: seller cannot delete another seller\'s products', () => {
  test('vendeur2 cannot delete vendeur1 product via API (403/404)', async ({ page }) => {
    // === SETUP ===
    const { token: token1 } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);

    const productId = await createProductForSeller(page, token1, {
      name: 'E2E-25-Ownership-V1',
      price: 100,
      stock_quantity: 50,
      is_active: true,
    });

    const { token: token2 } = await loginAs(page, VENDEUR2_EMAIL, VENDEUR2_PASSWORD);

    // === ACTION: vendeur2 tries to delete vendeur1's product ===
    const response = await page.request.delete(
      `${API_URL}/seller/products/${productId}`,
      {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token2}`,
        },
      }
    );

    // === VÉRIFICATION ===
    // Should return 403 or 404 (scoped to authenticated seller)
    expect([403, 404]).toContain(response.status());

    // === VÉRIFICATION DB: product must still exist ===
    await db.assertExists('products', { id: productId });
  });

  test('vendeur1 cannot delete vendeur2 product via API (403/404)', async ({ page }) => {
    // === SETUP ===
    const { token: token2 } = await loginAs(page, VENDEUR2_EMAIL, VENDEUR2_PASSWORD);

    const productId = await createProductForSeller(page, token2, {
      name: 'E2E-25-Ownership-V2',
      price: 75,
      stock_quantity: 20,
      is_active: true,
    });

    const { token: token1 } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);

    // === ACTION: vendeur1 tries to delete vendeur2's product ===
    const response = await page.request.delete(
      `${API_URL}/seller/products/${productId}`,
      {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token1}`,
        },
      }
    );

    // === VÉRIFICATION ===
    expect([403, 404]).toContain(response.status());

    // === VÉRIFICATION DB: product must still exist ===
    await db.assertExists('products', { id: productId });
  });

  test('admin cannot delete seller product via seller API (403)', async ({ page }) => {
    // === SETUP ===
    const { token: vendeurToken } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);

    const productId = await createProductForSeller(page, vendeurToken, {
      name: 'E2E-25-Admin-NoDelete',
      price: 50,
      stock_quantity: 10,
      is_active: true,
    });

    const { token: adminToken } = await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);

    // === ACTION: admin tries to delete ===
    const response = await page.request.delete(
      `${API_URL}/seller/products/${productId}`,
      {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
      }
    );

    // === VÉRIFICATION ===
    expect(response.status()).toBe(403);

    // Product must still exist
    await db.assertExists('products', { id: productId });
  });
});

// ===========================================================================
// DB VERIFICATION — Delete correctly removes all traces
// ===========================================================================

test.describe('Story 2.5 — DB verification: delete removes product permanently', () => {
  test('delete does not leave orphan records or affect other products', async ({ page }) => {
    // === SETUP ===
    const { token, userId } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);

    const productToDelete = await createProductForSeller(page, token, {
      name: 'E2E-25-DB-Orphan-Delete',
      price: 20,
      stock_quantity: 5,
      is_active: true,
    });

    const productToKeep = await createProductForSeller(page, token, {
      name: 'E2E-25-DB-Orphan-Keep',
      price: 30,
      stock_quantity: 10,
      is_active: true,
    });

    // === ACTION ===
    const response = await page.request.delete(
      `${API_URL}/seller/products/${productToDelete}`,
      {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      }
    );
    expect(response.status()).toBe(204);

    // === VÉRIFICATION DB ===
    // Deleted product is gone
    await db.assertNotExists('products', { id: productToDelete });

    // Other product still exists and is unchanged
    const keptProduct = await db.assertExists('products', { id: productToKeep });
    expect(keptProduct.name).toBe('E2E-25-DB-Orphan-Keep');
    expect(Number(keptProduct.price)).toBeCloseTo(30, 2);
    expect(keptProduct.stock_quantity).toBe(10);
    expect(keptProduct.user_id).toBe(userId);

    // Seller user still exists (foreign key not cascade-deleted)
    const user = await db.assertExists('users', { id: userId });
    expect(user.role).toBe('vendeur');
  });

  test('delete count decreases by exactly 1', async ({ page }) => {
    // === SETUP ===
    const vendeur = await db.findOne('users', { email: VENDEUR_EMAIL });
    expect(vendeur).toBeTruthy();
    await db.query('DELETE FROM products WHERE user_id = ?', [vendeur!.id]);

    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);

    // Create exactly 3 products
    const toDelete = await createProductForSeller(page, token, {
      name: 'E2E-25-DB-Count-Del',
      price: 10,
      stock_quantity: 1,
      is_active: true,
    });
    await createProductForSeller(page, token, {
      name: 'E2E-25-DB-Count-Keep1',
      price: 20,
      stock_quantity: 2,
      is_active: true,
    });
    await createProductForSeller(page, token, {
      name: 'E2E-25-DB-Count-Keep2',
      price: 30,
      stock_quantity: 3,
      is_active: false,
    });

    // Verify initial count
    const countBefore = await db.count('products', { user_id: vendeur!.id });
    expect(countBefore).toBe(3);

    // === ACTION ===
    const response = await page.request.delete(
      `${API_URL}/seller/products/${toDelete}`,
      {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      }
    );
    expect(response.status()).toBe(204);

    // === VÉRIFICATION DB ===
    const countAfter = await db.count('products', { user_id: vendeur!.id });
    expect(countAfter).toBe(2);
  });
});

// ===========================================================================
// UI — DELETE FEEDBACK TOAST BEHAVIOR
// ===========================================================================

test.describe('Story 2.5 — UI: Delete feedback toast behavior', () => {
  test('delete feedback toast can be manually dismissed', async ({ page }) => {
    // === SETUP ===
    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);

    const productId = await createProductForSeller(page, token, {
      name: 'E2E-25-Toast-Dismiss',
      price: 12,
      stock_quantity: 5,
      is_active: true,
    });

    // === ACTION ===
    await page.goto('/seller/dashboard');
    await page.locator(`[data-testid="seller-delete-product-btn-${productId}"]`).click();
    await page.locator('[data-testid="confirm-dialog-confirm-btn"]').click();

    // Toast should appear
    await expect(page.locator('[data-testid="delete-feedback"]')).toBeVisible();

    // Click dismiss button
    await page.locator('[data-testid="delete-feedback-dismiss-btn"]').click();

    // === VÉRIFICATION UI ===
    // Toast should disappear
    await expect(page.locator('[data-testid="delete-feedback"]')).not.toBeVisible();
  });

  test('delete feedback toast auto-dismisses after a few seconds', async ({ page }) => {
    // === SETUP ===
    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);

    const productId = await createProductForSeller(page, token, {
      name: 'E2E-25-Toast-AutoDismiss',
      price: 18,
      stock_quantity: 4,
      is_active: true,
    });

    // === ACTION ===
    await page.goto('/seller/dashboard');
    await page.locator(`[data-testid="seller-delete-product-btn-${productId}"]`).click();
    await page.locator('[data-testid="confirm-dialog-confirm-btn"]').click();

    // Toast should appear
    await expect(page.locator('[data-testid="delete-feedback"]')).toBeVisible();

    // === VÉRIFICATION UI ===
    // Toast should auto-dismiss (within ~4 seconds to account for animation)
    await expect(page.locator('[data-testid="delete-feedback"]')).not.toBeVisible({
      timeout: 5_000,
    });
  });
});

// ===========================================================================
// UI — MOBILE: Delete via card buttons
// ===========================================================================

test.describe('Story 2.5 — UI: Delete via mobile card buttons', () => {
  test('clicking delete on mobile card opens confirmation dialog', async ({ page }) => {
    // === SETUP ===
    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);

    const productId = await createProductForSeller(page, token, {
      name: 'E2E-25-Mobile-Dialog',
      price: 22.50,
      stock_quantity: 7,
      is_active: true,
    });

    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // === ACTION ===
    await page.goto('/seller/dashboard');

    // Click delete on mobile card
    await page.locator(`[data-testid="seller-card-delete-product-btn-${productId}"]`).click();

    // === VÉRIFICATION UI ===
    // Confirmation dialog should be visible
    await expect(page.locator('[data-testid="confirm-dialog"]')).toBeVisible();
    await expect(page.locator('[data-testid="confirm-dialog-message"]')).toContainText(
      'E2E-25-Mobile-Dialog'
    );
  });

  test('confirming delete on mobile removes the product card', async ({ page }) => {
    // === SETUP ===
    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);

    const productId = await createProductForSeller(page, token, {
      name: 'E2E-25-Mobile-Confirm',
      price: 33,
      stock_quantity: 4,
      is_active: true,
    });

    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // === ACTION ===
    await page.goto('/seller/dashboard');

    const productCard = page.locator(`[data-testid="seller-product-card-${productId}"]`);
    await expect(productCard).toBeVisible();

    // Delete via mobile button
    await page.locator(`[data-testid="seller-card-delete-product-btn-${productId}"]`).click();
    await page.locator('[data-testid="confirm-dialog-confirm-btn"]').click();

    // === VÉRIFICATION UI ===
    // Product card should no longer be visible
    await expect(productCard).not.toBeVisible();

    // === VÉRIFICATION DB ===
    await db.assertNotExists('products', { id: productId });
  });
});
