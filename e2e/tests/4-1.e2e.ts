import { test, expect } from '@playwright/test';
import { loginAs, logout } from '../helpers/auth';
import { db } from '../helpers/database';

/**
 * Story 4.1 — Add to Cart
 *
 * AC1: Given a logged-in buyer is on a product detail page with stock > 0
 *      When they click "Add to cart"
 *      Then the product is added to their cart with quantity 1
 *      And a visual feedback confirms the addition in under 500ms
 *
 * AC2: Given a buyer adds a product already in their cart
 *      When they click "Add to cart"
 *      Then the quantity for that product is incremented by 1
 *
 * AC3: Given a visitor (not logged in) clicks "Add to cart"
 *      When the action is triggered
 *      Then a message invites them to log in or create an account
 *      And the product URL is saved for post-registration redirect
 *
 * Pre-conditions:
 * - e2e-vendeur@test.com / password exists with role "vendeur" (from E2ETestSeeder)
 * - e2e@test.com / password exists with role "acheteur" (from E2ETestSeeder)
 * - Products exist in DB (created via seller API in beforeAll)
 *
 * The tests describe EXPECTED behavior (TDD). They will fail until:
 * - Backend: Cart & CartItem models + migrations
 * - Backend: POST /api/cart/items endpoint (CartController@addItem)
 * - Backend: Cart persisted in DB (NFR18 — not in session)
 * - Frontend: useCartStore calls real API
 * - Frontend: Add to cart button on ProductDetailPage
 * - Frontend: Toast feedback (NFR3: < 500ms)
 * - Frontend: LoginPromptModal for unauthenticated visitors
 * - Frontend: Cart badge in header (nav-cart-badge, nav-cart-count)
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
// Helper: create a product via seller API
// ---------------------------------------------------------------------------
interface CreatedProduct {
  id: number;
  name: string;
  price: number;
  stock_quantity: number;
}

async function createProductViaSeller(
  page: import('@playwright/test').Page,
  token: string,
  overrides: {
    name: string;
    description?: string;
    category?: string;
    price?: number;
    stock_quantity?: number;
    is_active?: boolean;
    photo_url?: string | null;
    specs?: Record<string, string>;
    restock_date?: string | null;
  }
): Promise<CreatedProduct> {
  const data = {
    name: overrides.name,
    description: overrides.description ?? `Description e2e pour ${overrides.name}`,
    category: overrides.category ?? 'cpu',
    price: overrides.price ?? 99.99,
    stock_quantity: overrides.stock_quantity ?? 10,
    is_active: overrides.is_active ?? true,
    photo_url: overrides.photo_url ?? null,
    specs: overrides.specs ?? { Marque: 'E2E-Brand', Modèle: 'E2E-Model' },
    restock_date: overrides.restock_date ?? null,
  };

  const response = await page.request.post(`${API_URL}/seller/products`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
    data,
  });

  if (!response.ok()) {
    const body = await response.text();
    throw new Error(`Create product API failed (${response.status()}): ${body}`);
  }

  const json = await response.json();
  return {
    id: json.data.id,
    name: data.name,
    price: data.price,
    stock_quantity: data.stock_quantity,
  };
}

// ---------------------------------------------------------------------------
// Test data: unique names for isolation
// ---------------------------------------------------------------------------
const TS = Date.now();
const PRODUCT_CART_NAME = `E2E-4.1-CartProduct-${TS}`;
const PRODUCT_CART_2_NAME = `E2E-4.1-CartProduct2-${TS}`;
const PRODUCT_OUT_OF_STOCK_NAME = `E2E-4.1-OutOfStock-${TS}`;

let productCartId: number;
let productCart2Id: number;
let productOutOfStockId: number;
let vendeurToken: string;
let acheteurUserId: number;

// ---------------------------------------------------------------------------
// Setup: create test products via seller API
// ---------------------------------------------------------------------------
test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  try {
    // Login as vendeur to create products
    const vendeurAuth = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);
    vendeurToken = vendeurAuth.token;

    // Product 1: In stock (for add to cart tests)
    const product1 = await createProductViaSeller(page, vendeurToken, {
      name: PRODUCT_CART_NAME,
      description: 'Produit e2e pour tester l\'ajout au panier. Processeur de test.',
      category: 'cpu',
      price: 299.99,
      stock_quantity: 50,
      is_active: true,
    });
    productCartId = product1.id;

    // Product 2: Another in-stock product (for testing multiple products)
    const product2 = await createProductViaSeller(page, vendeurToken, {
      name: PRODUCT_CART_2_NAME,
      description: 'Second produit e2e pour tester l\'ajout au panier.',
      category: 'gpu',
      price: 599.99,
      stock_quantity: 5,
      is_active: true,
    });
    productCart2Id = product2.id;

    // Product 3: Out of stock (button should be disabled)
    const product3 = await createProductViaSeller(page, vendeurToken, {
      name: PRODUCT_OUT_OF_STOCK_NAME,
      description: 'Produit en rupture de stock, ajout au panier impossible.',
      category: 'ram',
      price: 149.99,
      stock_quantity: 0,
      is_active: true,
      restock_date: '2026-04-01',
    });
    productOutOfStockId = product3.id;

    // Login as acheteur to get user ID (for DB assertions)
    await logout(page);
    const acheteurAuth = await loginAs(page, ACHETEUR_EMAIL, ACHETEUR_PASSWORD);
    acheteurUserId = acheteurAuth.userId;
  } finally {
    await page.close();
  }
});

// ---------------------------------------------------------------------------
// Cleanup: delete test data and close DB pool
// ---------------------------------------------------------------------------
test.afterAll(async () => {
  // Clean up cart items for our test products
  await db.query(
    'DELETE FROM cart_items WHERE product_id IN (SELECT id FROM products WHERE name LIKE ?)',
    ['E2E-4.1-%']
  );
  // Clean up carts for the test acheteur
  await db.query(
    'DELETE FROM cart_items WHERE cart_id IN (SELECT id FROM carts WHERE user_id = ?)',
    [acheteurUserId]
  );
  await db.query('DELETE FROM carts WHERE user_id = ?', [acheteurUserId]);
  // Clean up test products
  await db.query('DELETE FROM products WHERE name LIKE ?', ['E2E-4.1-%']);
  await db.cleanup();
});

// ═══════════════════════════════════════════════════════════════════════════
// AC1 — Logged-in buyer adds a product to cart (quantity 1) with feedback
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Story 4.1 — AC1: Buyer adds product to cart', () => {

  test('add-to-cart button is visible and enabled for in-stock product', async ({ page }) => {
    // === SETUP ===
    await loginAs(page, ACHETEUR_EMAIL, ACHETEUR_PASSWORD);

    // === ACTION ===
    await page.goto(`/products/${productCartId}`);

    // === VÉRIFICATION UI ===
    const addBtn = page.locator('[data-testid="add-to-cart-btn"]');
    await expect(addBtn).toBeVisible();
    await expect(addBtn).not.toBeDisabled();
    await expect(addBtn).toContainText('Ajouter au panier');
  });

  test('clicking "Ajouter au panier" shows a success toast with the product name', async ({ page }) => {
    // === SETUP ===
    await loginAs(page, ACHETEUR_EMAIL, ACHETEUR_PASSWORD);
    await page.goto(`/products/${productCartId}`);

    // === ACTION ===
    await page.locator('[data-testid="add-to-cart-btn"]').click();

    // === VÉRIFICATION UI ===
    const toast = page.locator('[data-testid="add-to-cart-toast"]');
    await expect(toast).toBeVisible();

    const toastMessage = page.locator('[data-testid="add-to-cart-toast-message"]');
    await expect(toastMessage).toContainText(PRODUCT_CART_NAME);
    await expect(toastMessage).toContainText(/ajouté au panier/i);
  });

  test('toast feedback appears in under 500ms (NFR3)', async ({ page }) => {
    // === SETUP ===
    await loginAs(page, ACHETEUR_EMAIL, ACHETEUR_PASSWORD);
    await page.goto(`/products/${productCartId}`);

    // === ACTION ===
    const startTime = Date.now();
    await page.locator('[data-testid="add-to-cart-btn"]').click();

    // Wait for toast to be visible
    await expect(page.locator('[data-testid="add-to-cart-toast"]')).toBeVisible();
    const feedbackTime = Date.now() - startTime;

    // === VÉRIFICATION PERFORMANCE ===
    // NFR3: visual feedback must appear in under 500ms
    expect(feedbackTime).toBeLessThan(500);
  });

  test('toast can be closed by clicking the close button', async ({ page }) => {
    // === SETUP ===
    await loginAs(page, ACHETEUR_EMAIL, ACHETEUR_PASSWORD);
    await page.goto(`/products/${productCartId}`);

    // === ACTION ===
    await page.locator('[data-testid="add-to-cart-btn"]').click();
    await expect(page.locator('[data-testid="add-to-cart-toast"]')).toBeVisible();

    // Close the toast
    await page.locator('[data-testid="add-to-cart-toast-close-btn"]').click();

    // === VÉRIFICATION UI ===
    await expect(page.locator('[data-testid="add-to-cart-toast"]')).not.toBeVisible();
  });

  test('product is added to cart with quantity 1 in database (NFR18)', async ({ page }) => {
    // === SETUP ===
    // Clean any existing cart for this user first
    await db.query(
      'DELETE FROM cart_items WHERE cart_id IN (SELECT id FROM carts WHERE user_id = ?)',
      [acheteurUserId]
    );
    await db.query('DELETE FROM carts WHERE user_id = ?', [acheteurUserId]);

    await loginAs(page, ACHETEUR_EMAIL, ACHETEUR_PASSWORD);
    await page.goto(`/products/${productCartId}`);

    // === ACTION ===
    await page.locator('[data-testid="add-to-cart-btn"]').click();
    await expect(page.locator('[data-testid="add-to-cart-toast"]')).toBeVisible();

    // === VÉRIFICATION DB ===
    // NFR18: cart must be persisted in DB (not in session)
    const cart = await db.assertExists('carts', { user_id: acheteurUserId });
    expect(cart.id).toBeGreaterThan(0);

    // Cart item should exist with quantity 1
    const cartItem = await db.assertExists('cart_items', {
      cart_id: cart.id,
      product_id: productCartId,
    });
    expect(cartItem.quantity).toBe(1);
  });

  test('cart item has valid foreign keys (no orphans)', async ({ page }) => {
    // === SETUP ===
    await loginAs(page, ACHETEUR_EMAIL, ACHETEUR_PASSWORD);
    await page.goto(`/products/${productCartId}`);

    // === ACTION ===
    await page.locator('[data-testid="add-to-cart-btn"]').click();
    await expect(page.locator('[data-testid="add-to-cart-toast"]')).toBeVisible();

    // === VÉRIFICATION DB ===
    // Verify cart belongs to the correct user
    const cart = await db.assertExists('carts', { user_id: acheteurUserId });

    // Verify user exists (no orphan cart)
    const user = await db.assertExists('users', { id: acheteurUserId });
    expect(user.email).toBe(ACHETEUR_EMAIL);

    // Verify product exists (no orphan cart item)
    const cartItem = await db.assertExists('cart_items', {
      cart_id: cart.id,
      product_id: productCartId,
    });
    const product = await db.assertExists('products', { id: cartItem.product_id });
    expect(product.name).toBe(PRODUCT_CART_NAME);
  });

  test('cart badge in header updates after adding item', async ({ page }) => {
    // === SETUP ===
    // Clean cart
    await db.query(
      'DELETE FROM cart_items WHERE cart_id IN (SELECT id FROM carts WHERE user_id = ?)',
      [acheteurUserId]
    );
    await db.query('DELETE FROM carts WHERE user_id = ?', [acheteurUserId]);

    await loginAs(page, ACHETEUR_EMAIL, ACHETEUR_PASSWORD);
    await page.goto(`/products/${productCartId}`);

    // === ACTION ===
    await page.locator('[data-testid="add-to-cart-btn"]').click();
    await expect(page.locator('[data-testid="add-to-cart-toast"]')).toBeVisible();

    // === VÉRIFICATION UI ===
    // Cart badge should appear in header with count
    const cartBadge = page.locator('[data-testid="nav-cart-badge"]');
    await expect(cartBadge).toBeVisible();

    const cartCount = page.locator('[data-testid="nav-cart-count"]');
    await expect(cartCount).toBeVisible();
    await expect(cartCount).toContainText('1');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// AC2 — Product already in cart → quantity incremented by 1
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Story 4.1 — AC2: Add same product again increments quantity', () => {

  test('clicking "Ajouter au panier" twice increments quantity to 2', async ({ page }) => {
    // === SETUP ===
    // Clean cart
    await db.query(
      'DELETE FROM cart_items WHERE cart_id IN (SELECT id FROM carts WHERE user_id = ?)',
      [acheteurUserId]
    );
    await db.query('DELETE FROM carts WHERE user_id = ?', [acheteurUserId]);

    await loginAs(page, ACHETEUR_EMAIL, ACHETEUR_PASSWORD);
    await page.goto(`/products/${productCartId}`);

    // === ACTION ===
    // First click — quantity 1
    await page.locator('[data-testid="add-to-cart-btn"]').click();
    await expect(page.locator('[data-testid="add-to-cart-toast"]')).toBeVisible();

    // Close toast and click again — quantity should be 2
    await page.locator('[data-testid="add-to-cart-toast-close-btn"]').click();
    await expect(page.locator('[data-testid="add-to-cart-toast"]')).not.toBeVisible();

    // Second click
    await page.locator('[data-testid="add-to-cart-btn"]').click();
    await expect(page.locator('[data-testid="add-to-cart-toast"]')).toBeVisible();

    // === VÉRIFICATION DB ===
    const cart = await db.assertExists('carts', { user_id: acheteurUserId });

    const cartItem = await db.assertExists('cart_items', {
      cart_id: cart.id,
      product_id: productCartId,
    });
    expect(cartItem.quantity).toBe(2);

    // Should still be ONE cart item, not two separate entries
    const itemCount = await db.count('cart_items', {
      cart_id: cart.id,
      product_id: productCartId,
    });
    expect(itemCount).toBe(1);
  });

  test('clicking 3 times results in quantity 3 in DB', async ({ page }) => {
    // === SETUP ===
    // Clean cart
    await db.query(
      'DELETE FROM cart_items WHERE cart_id IN (SELECT id FROM carts WHERE user_id = ?)',
      [acheteurUserId]
    );
    await db.query('DELETE FROM carts WHERE user_id = ?', [acheteurUserId]);

    await loginAs(page, ACHETEUR_EMAIL, ACHETEUR_PASSWORD);
    await page.goto(`/products/${productCartId}`);

    // === ACTION ===
    for (let i = 0; i < 3; i++) {
      await page.locator('[data-testid="add-to-cart-btn"]').click();
      await expect(page.locator('[data-testid="add-to-cart-toast"]')).toBeVisible();
      // Close toast before next click (except last)
      if (i < 2) {
        await page.locator('[data-testid="add-to-cart-toast-close-btn"]').click();
        await expect(page.locator('[data-testid="add-to-cart-toast"]')).not.toBeVisible();
      }
    }

    // === VÉRIFICATION DB ===
    const cart = await db.assertExists('carts', { user_id: acheteurUserId });
    const cartItem = await db.assertExists('cart_items', {
      cart_id: cart.id,
      product_id: productCartId,
    });
    expect(cartItem.quantity).toBe(3);
  });

  test('cart badge shows correct total after adding same product multiple times', async ({ page }) => {
    // === SETUP ===
    // Clean cart
    await db.query(
      'DELETE FROM cart_items WHERE cart_id IN (SELECT id FROM carts WHERE user_id = ?)',
      [acheteurUserId]
    );
    await db.query('DELETE FROM carts WHERE user_id = ?', [acheteurUserId]);

    await loginAs(page, ACHETEUR_EMAIL, ACHETEUR_PASSWORD);
    await page.goto(`/products/${productCartId}`);

    // === ACTION ===
    // Add twice
    await page.locator('[data-testid="add-to-cart-btn"]').click();
    await expect(page.locator('[data-testid="add-to-cart-toast"]')).toBeVisible();
    await page.locator('[data-testid="add-to-cart-toast-close-btn"]').click();

    await page.locator('[data-testid="add-to-cart-btn"]').click();
    await expect(page.locator('[data-testid="add-to-cart-toast"]')).toBeVisible();

    // === VÉRIFICATION UI ===
    const cartCount = page.locator('[data-testid="nav-cart-count"]');
    await expect(cartCount).toBeVisible();
    await expect(cartCount).toContainText('2');
  });

  test('adding two different products creates two distinct cart items', async ({ page }) => {
    // === SETUP ===
    // Clean cart
    await db.query(
      'DELETE FROM cart_items WHERE cart_id IN (SELECT id FROM carts WHERE user_id = ?)',
      [acheteurUserId]
    );
    await db.query('DELETE FROM carts WHERE user_id = ?', [acheteurUserId]);

    await loginAs(page, ACHETEUR_EMAIL, ACHETEUR_PASSWORD);

    // === ACTION ===
    // Add first product
    await page.goto(`/products/${productCartId}`);
    await page.locator('[data-testid="add-to-cart-btn"]').click();
    await expect(page.locator('[data-testid="add-to-cart-toast"]')).toBeVisible();

    // Add second product
    await page.goto(`/products/${productCart2Id}`);
    await page.locator('[data-testid="add-to-cart-btn"]').click();
    await expect(page.locator('[data-testid="add-to-cart-toast"]')).toBeVisible();

    // === VÉRIFICATION DB ===
    const cart = await db.assertExists('carts', { user_id: acheteurUserId });

    // Two separate cart items
    const item1 = await db.assertExists('cart_items', {
      cart_id: cart.id,
      product_id: productCartId,
    });
    expect(item1.quantity).toBe(1);

    const item2 = await db.assertExists('cart_items', {
      cart_id: cart.id,
      product_id: productCart2Id,
    });
    expect(item2.quantity).toBe(1);

    // Total items in cart = 2 entries
    const totalItems = await db.count('cart_items', { cart_id: cart.id });
    expect(totalItems).toBe(2);
  });

  test('adding same product after adding another product increments the correct item', async ({ page }) => {
    // === SETUP ===
    // Clean cart
    await db.query(
      'DELETE FROM cart_items WHERE cart_id IN (SELECT id FROM carts WHERE user_id = ?)',
      [acheteurUserId]
    );
    await db.query('DELETE FROM carts WHERE user_id = ?', [acheteurUserId]);

    await loginAs(page, ACHETEUR_EMAIL, ACHETEUR_PASSWORD);

    // === ACTION ===
    // Add product 1
    await page.goto(`/products/${productCartId}`);
    await page.locator('[data-testid="add-to-cart-btn"]').click();
    await expect(page.locator('[data-testid="add-to-cart-toast"]')).toBeVisible();

    // Add product 2
    await page.goto(`/products/${productCart2Id}`);
    await page.locator('[data-testid="add-to-cart-btn"]').click();
    await expect(page.locator('[data-testid="add-to-cart-toast"]')).toBeVisible();

    // Add product 1 again → should increment qty to 2
    await page.goto(`/products/${productCartId}`);
    await page.locator('[data-testid="add-to-cart-btn"]').click();
    await expect(page.locator('[data-testid="add-to-cart-toast"]')).toBeVisible();

    // === VÉRIFICATION DB ===
    const cart = await db.assertExists('carts', { user_id: acheteurUserId });

    const item1 = await db.assertExists('cart_items', {
      cart_id: cart.id,
      product_id: productCartId,
    });
    expect(item1.quantity).toBe(2);

    const item2 = await db.assertExists('cart_items', {
      cart_id: cart.id,
      product_id: productCart2Id,
    });
    expect(item2.quantity).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// AC3 — Visitor (not logged in) → login prompt modal
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Story 4.1 — AC3: Visitor sees login prompt', () => {

  test('clicking "Ajouter au panier" when not logged in shows the login prompt modal', async ({ page }) => {
    // === SETUP ===
    await logout(page);
    await page.goto(`/products/${productCartId}`);

    // === ACTION ===
    await page.locator('[data-testid="add-to-cart-btn"]').click();

    // === VÉRIFICATION UI ===
    const modal = page.locator('[data-testid="login-prompt-modal"]');
    await expect(modal).toBeVisible();

    // Modal title
    const title = page.locator('[data-testid="login-prompt-title"]');
    await expect(title).toBeVisible();
    await expect(title).toContainText(/connectez-vous/i);
  });

  test('login prompt modal shows explanatory message', async ({ page }) => {
    // === SETUP ===
    await logout(page);
    await page.goto(`/products/${productCartId}`);

    // === ACTION ===
    await page.locator('[data-testid="add-to-cart-btn"]').click();

    // === VÉRIFICATION UI ===
    const message = page.locator('[data-testid="login-prompt-message"]');
    await expect(message).toBeVisible();
    await expect(message).toContainText(/connecté/i);
  });

  test('login prompt has "Se connecter" button linking to login', async ({ page }) => {
    // === SETUP ===
    await logout(page);
    await page.goto(`/products/${productCartId}`);

    // === ACTION ===
    await page.locator('[data-testid="add-to-cart-btn"]').click();
    await expect(page.locator('[data-testid="login-prompt-modal"]')).toBeVisible();

    // === VÉRIFICATION UI ===
    const loginBtn = page.locator('[data-testid="login-prompt-login-btn"]');
    await expect(loginBtn).toBeVisible();
    await expect(loginBtn).toContainText(/se connecter/i);

    // Verify it links to login page
    const href = await loginBtn.getAttribute('href');
    expect(href).toContain('/login');
  });

  test('login prompt has "Créer un compte" button linking to register', async ({ page }) => {
    // === SETUP ===
    await logout(page);
    await page.goto(`/products/${productCartId}`);

    // === ACTION ===
    await page.locator('[data-testid="add-to-cart-btn"]').click();
    await expect(page.locator('[data-testid="login-prompt-modal"]')).toBeVisible();

    // === VÉRIFICATION UI ===
    const registerBtn = page.locator('[data-testid="login-prompt-register-btn"]');
    await expect(registerBtn).toBeVisible();
    await expect(registerBtn).toContainText(/créer un compte/i);

    // Verify it links to register page
    const href = await registerBtn.getAttribute('href');
    expect(href).toContain('/register');
  });

  test('login prompt saves the product URL for post-login redirect', async ({ page }) => {
    // === SETUP ===
    await logout(page);
    await page.goto(`/products/${productCartId}`);

    // === ACTION ===
    await page.locator('[data-testid="add-to-cart-btn"]').click();
    await expect(page.locator('[data-testid="login-prompt-modal"]')).toBeVisible();

    // === VÉRIFICATION UI ===
    // The redirect URL should be saved (hidden input or link query param)
    const redirectInput = page.locator('[data-testid="login-prompt-redirect-url"]');
    const redirectValue = await redirectInput.getAttribute('value');
    expect(redirectValue).toContain(`/products/${productCartId}`);

    // Login button should include redirect query parameter
    const loginBtn = page.locator('[data-testid="login-prompt-login-btn"]');
    const href = await loginBtn.getAttribute('href');
    expect(href).toContain(`redirect=`);
    expect(href).toContain(`/products/${productCartId}`);
  });

  test('register link also includes redirect query parameter', async ({ page }) => {
    // === SETUP ===
    await logout(page);
    await page.goto(`/products/${productCartId}`);

    // === ACTION ===
    await page.locator('[data-testid="add-to-cart-btn"]').click();
    await expect(page.locator('[data-testid="login-prompt-modal"]')).toBeVisible();

    // === VÉRIFICATION UI ===
    const registerBtn = page.locator('[data-testid="login-prompt-register-btn"]');
    const href = await registerBtn.getAttribute('href');
    expect(href).toContain(`redirect=`);
    expect(href).toContain(`/products/${productCartId}`);
  });

  test('login prompt can be closed with "Continuer sans compte" button', async ({ page }) => {
    // === SETUP ===
    await logout(page);
    await page.goto(`/products/${productCartId}`);

    // === ACTION ===
    await page.locator('[data-testid="add-to-cart-btn"]').click();
    await expect(page.locator('[data-testid="login-prompt-modal"]')).toBeVisible();

    // Close it
    await page.locator('[data-testid="login-prompt-cancel-btn"]').click();

    // === VÉRIFICATION UI ===
    await expect(page.locator('[data-testid="login-prompt-modal"]')).not.toBeVisible();
  });

  test('login prompt can be closed with the close (X) button', async ({ page }) => {
    // === SETUP ===
    await logout(page);
    await page.goto(`/products/${productCartId}`);

    // === ACTION ===
    await page.locator('[data-testid="add-to-cart-btn"]').click();
    await expect(page.locator('[data-testid="login-prompt-modal"]')).toBeVisible();

    // Close via X button
    await page.locator('[data-testid="login-prompt-close-btn"]').click();

    // === VÉRIFICATION UI ===
    await expect(page.locator('[data-testid="login-prompt-modal"]')).not.toBeVisible();
  });

  test('login prompt can be closed by clicking the backdrop', async ({ page }) => {
    // === SETUP ===
    await logout(page);
    await page.goto(`/products/${productCartId}`);

    // === ACTION ===
    await page.locator('[data-testid="add-to-cart-btn"]').click();
    await expect(page.locator('[data-testid="login-prompt-modal"]')).toBeVisible();

    // Close via backdrop click
    await page.locator('[data-testid="login-prompt-backdrop"]').click({ force: true });

    // === VÉRIFICATION UI ===
    await expect(page.locator('[data-testid="login-prompt-modal"]')).not.toBeVisible();
  });

  test('clicking "Se connecter" navigates to login page', async ({ page }) => {
    // === SETUP ===
    await logout(page);
    await page.goto(`/products/${productCartId}`);

    // === ACTION ===
    await page.locator('[data-testid="add-to-cart-btn"]').click();
    await expect(page.locator('[data-testid="login-prompt-modal"]')).toBeVisible();

    await page.locator('[data-testid="login-prompt-login-btn"]').click();

    // === VÉRIFICATION UI ===
    await page.waitForURL('**/login**');
    expect(page.url()).toContain('/login');
  });

  test('clicking "Créer un compte" navigates to register page', async ({ page }) => {
    // === SETUP ===
    await logout(page);
    await page.goto(`/products/${productCartId}`);

    // === ACTION ===
    await page.locator('[data-testid="add-to-cart-btn"]').click();
    await expect(page.locator('[data-testid="login-prompt-modal"]')).toBeVisible();

    await page.locator('[data-testid="login-prompt-register-btn"]').click();

    // === VÉRIFICATION UI ===
    await page.waitForURL('**/register**');
    expect(page.url()).toContain('/register');
  });

  test('no cart is created in DB when visitor clicks "Ajouter au panier"', async ({ page }) => {
    // === SETUP ===
    await logout(page);
    await page.goto(`/products/${productCartId}`);

    // Count carts before
    const cartCountBefore = await db.count('carts');

    // === ACTION ===
    await page.locator('[data-testid="add-to-cart-btn"]').click();
    await expect(page.locator('[data-testid="login-prompt-modal"]')).toBeVisible();

    // === VÉRIFICATION DB ===
    // No new cart should be created for unauthenticated users
    const cartCountAfter = await db.count('carts');
    expect(cartCountAfter).toBe(cartCountBefore);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Edge cases: Out of stock, disabled button
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Story 4.1 — Edge case: Out-of-stock product', () => {

  test('add-to-cart button is disabled for out-of-stock product', async ({ page }) => {
    // === SETUP ===
    await loginAs(page, ACHETEUR_EMAIL, ACHETEUR_PASSWORD);

    // === ACTION ===
    await page.goto(`/products/${productOutOfStockId}`);

    // === VÉRIFICATION UI ===
    const addBtn = page.locator('[data-testid="add-to-cart-btn"]');
    await expect(addBtn).toBeVisible();
    await expect(addBtn).toBeDisabled();
  });

  test('out-of-stock button shows "Indisponible" text', async ({ page }) => {
    // === SETUP ===
    await loginAs(page, ACHETEUR_EMAIL, ACHETEUR_PASSWORD);

    // === ACTION ===
    await page.goto(`/products/${productOutOfStockId}`);

    // === VÉRIFICATION UI ===
    const addBtn = page.locator('[data-testid="add-to-cart-btn"]');
    await expect(addBtn).toContainText('Indisponible');
  });

  test('clicking disabled button does NOT show toast', async ({ page }) => {
    // === SETUP ===
    await loginAs(page, ACHETEUR_EMAIL, ACHETEUR_PASSWORD);
    await page.goto(`/products/${productOutOfStockId}`);

    // === ACTION ===
    // Force-click the disabled button
    await page.locator('[data-testid="add-to-cart-btn"]').click({ force: true });

    // === VÉRIFICATION UI ===
    // Wait a bit to ensure no toast appears
    await page.waitForTimeout(300);
    await expect(page.locator('[data-testid="add-to-cart-toast"]')).not.toBeVisible();
  });

  test('clicking disabled button does NOT create a cart item in DB', async ({ page }) => {
    // === SETUP ===
    await loginAs(page, ACHETEUR_EMAIL, ACHETEUR_PASSWORD);
    await page.goto(`/products/${productOutOfStockId}`);

    const cartItemsBefore = await db.count('cart_items');

    // === ACTION ===
    await page.locator('[data-testid="add-to-cart-btn"]').click({ force: true });
    await page.waitForTimeout(300);

    // === VÉRIFICATION DB ===
    const cartItemsAfter = await db.count('cart_items');
    expect(cartItemsAfter).toBe(cartItemsBefore);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Role isolation: vendeur cannot add to cart
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Story 4.1 — Role isolation: Cart is for buyers only', () => {

  test('cart badge is visible in header for acheteur', async ({ page }) => {
    // === SETUP ===
    await loginAs(page, ACHETEUR_EMAIL, ACHETEUR_PASSWORD);

    // === ACTION ===
    await page.goto(`/products/${productCartId}`);

    // === VÉRIFICATION UI ===
    const cartBadge = page.locator('[data-testid="nav-cart-badge"]');
    await expect(cartBadge).toBeVisible();
  });

  test('cart badge is NOT visible in header for vendeur', async ({ page }) => {
    // === SETUP ===
    await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);

    // === ACTION ===
    await page.goto(`/products/${productCartId}`);

    // === VÉRIFICATION UI ===
    const cartBadge = page.locator('[data-testid="nav-cart-badge"]');
    await expect(cartBadge).not.toBeVisible();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// API contract: POST /api/cart/items
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Story 4.1 — API contract: POST /api/cart/items', () => {

  test('authenticated buyer can add item via API', async ({ page }) => {
    // === SETUP ===
    const auth = await loginAs(page, ACHETEUR_EMAIL, ACHETEUR_PASSWORD);

    // Clean cart
    await db.query(
      'DELETE FROM cart_items WHERE cart_id IN (SELECT id FROM carts WHERE user_id = ?)',
      [acheteurUserId]
    );
    await db.query('DELETE FROM carts WHERE user_id = ?', [acheteurUserId]);

    // === ACTION ===
    const response = await page.request.post(`${API_URL}/cart/items`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${auth.token}`,
      },
      data: {
        product_id: productCartId,
        quantity: 1,
      },
    });

    // === VÉRIFICATION API ===
    expect(response.status()).toBe(200);
    const json = await response.json();
    expect(json).toHaveProperty('data');
    expect(json.data).toHaveProperty('items');
    expect(Array.isArray(json.data.items)).toBeTruthy();

    // Should contain our product
    const addedItem = json.data.items.find(
      (item: { product_id: number }) => item.product_id === productCartId
    );
    expect(addedItem).toBeTruthy();
    expect(addedItem.quantity).toBe(1);
  });

  test('adding same product via API increments quantity', async ({ page }) => {
    // === SETUP ===
    const auth = await loginAs(page, ACHETEUR_EMAIL, ACHETEUR_PASSWORD);

    // Clean cart
    await db.query(
      'DELETE FROM cart_items WHERE cart_id IN (SELECT id FROM carts WHERE user_id = ?)',
      [acheteurUserId]
    );
    await db.query('DELETE FROM carts WHERE user_id = ?', [acheteurUserId]);

    // === ACTION ===
    // First add
    await page.request.post(`${API_URL}/cart/items`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${auth.token}`,
      },
      data: { product_id: productCartId },
    });

    // Second add
    const response = await page.request.post(`${API_URL}/cart/items`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${auth.token}`,
      },
      data: { product_id: productCartId },
    });

    // === VÉRIFICATION API ===
    expect(response.status()).toBe(200);
    const json = await response.json();
    const item = json.data.items.find(
      (i: { product_id: number }) => i.product_id === productCartId
    );
    expect(item).toBeTruthy();
    expect(item.quantity).toBe(2);
  });

  test('unauthenticated request returns 401', async ({ page }) => {
    // === ACTION ===
    const response = await page.request.post(`${API_URL}/cart/items`, {
      headers: {
        Accept: 'application/json',
      },
      data: {
        product_id: productCartId,
        quantity: 1,
      },
    });

    // === VÉRIFICATION API ===
    expect(response.status()).toBe(401);
  });

  test('adding inactive or non-existent product returns error', async ({ page }) => {
    // === SETUP ===
    const auth = await loginAs(page, ACHETEUR_EMAIL, ACHETEUR_PASSWORD);

    // === ACTION ===
    const response = await page.request.post(`${API_URL}/cart/items`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${auth.token}`,
      },
      data: {
        product_id: 999999,
        quantity: 1,
      },
    });

    // === VÉRIFICATION API ===
    // Should return 404 or 422 for non-existent product
    expect([404, 422]).toContain(response.status());
  });

  test('adding out-of-stock product returns error', async ({ page }) => {
    // === SETUP ===
    const auth = await loginAs(page, ACHETEUR_EMAIL, ACHETEUR_PASSWORD);

    // === ACTION ===
    const response = await page.request.post(`${API_URL}/cart/items`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${auth.token}`,
      },
      data: {
        product_id: productOutOfStockId,
        quantity: 1,
      },
    });

    // === VÉRIFICATION API ===
    // Should reject adding out-of-stock product
    expect([400, 422]).toContain(response.status());
  });

  test('API requires product_id field (validation)', async ({ page }) => {
    // === SETUP ===
    const auth = await loginAs(page, ACHETEUR_EMAIL, ACHETEUR_PASSWORD);

    // === ACTION ===
    const response = await page.request.post(`${API_URL}/cart/items`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${auth.token}`,
      },
      data: {},
    });

    // === VÉRIFICATION API ===
    expect(response.status()).toBe(422);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// DB verification: Cart persistence (NFR18)
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Story 4.1 — DB verification: Cart persistence (NFR18)', () => {

  test('cart persists in DB after page reload', async ({ page }) => {
    // === SETUP ===
    // Clean cart
    await db.query(
      'DELETE FROM cart_items WHERE cart_id IN (SELECT id FROM carts WHERE user_id = ?)',
      [acheteurUserId]
    );
    await db.query('DELETE FROM carts WHERE user_id = ?', [acheteurUserId]);

    await loginAs(page, ACHETEUR_EMAIL, ACHETEUR_PASSWORD);
    await page.goto(`/products/${productCartId}`);

    // === ACTION ===
    await page.locator('[data-testid="add-to-cart-btn"]').click();
    await expect(page.locator('[data-testid="add-to-cart-toast"]')).toBeVisible();

    // Reload the page
    await page.reload();

    // === VÉRIFICATION DB ===
    // Cart must still exist after reload (not session-based)
    const cart = await db.assertExists('carts', { user_id: acheteurUserId });
    const cartItem = await db.assertExists('cart_items', {
      cart_id: cart.id,
      product_id: productCartId,
    });
    expect(cartItem.quantity).toBe(1);
  });

  test('cart persists after logout and re-login (NFR18)', async ({ page }) => {
    // === SETUP ===
    // Clean cart
    await db.query(
      'DELETE FROM cart_items WHERE cart_id IN (SELECT id FROM carts WHERE user_id = ?)',
      [acheteurUserId]
    );
    await db.query('DELETE FROM carts WHERE user_id = ?', [acheteurUserId]);

    await loginAs(page, ACHETEUR_EMAIL, ACHETEUR_PASSWORD);
    await page.goto(`/products/${productCartId}`);

    // === ACTION ===
    // Add item
    await page.locator('[data-testid="add-to-cart-btn"]').click();
    await expect(page.locator('[data-testid="add-to-cart-toast"]')).toBeVisible();

    // Logout
    await logout(page);

    // Re-login
    await loginAs(page, ACHETEUR_EMAIL, ACHETEUR_PASSWORD);

    // === VÉRIFICATION DB ===
    // Cart must persist after logout/re-login
    const cart = await db.assertExists('carts', { user_id: acheteurUserId });
    const cartItem = await db.assertExists('cart_items', {
      cart_id: cart.id,
      product_id: productCartId,
    });
    expect(cartItem.quantity).toBe(1);
  });

  test('each buyer has their own isolated cart', async ({ page }) => {
    // === SETUP ===
    // Clean cart for acheteur
    await db.query(
      'DELETE FROM cart_items WHERE cart_id IN (SELECT id FROM carts WHERE user_id = ?)',
      [acheteurUserId]
    );
    await db.query('DELETE FROM carts WHERE user_id = ?', [acheteurUserId]);

    const auth = await loginAs(page, ACHETEUR_EMAIL, ACHETEUR_PASSWORD);
    await page.goto(`/products/${productCartId}`);

    // Add item as acheteur
    await page.locator('[data-testid="add-to-cart-btn"]').click();
    await expect(page.locator('[data-testid="add-to-cart-toast"]')).toBeVisible();

    // === VÉRIFICATION DB ===
    // Verify cart belongs to correct user
    const cart = await db.assertExists('carts', { user_id: acheteurUserId });

    // Other users should NOT have access to this cart
    const rows = await db.query(
      'SELECT * FROM carts WHERE id = ? AND user_id != ?',
      [cart.id, acheteurUserId]
    );
    expect(rows.length).toBe(0);
  });
});
