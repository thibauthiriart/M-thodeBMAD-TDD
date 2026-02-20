import { test, expect } from '@playwright/test';
import { RowDataPacket } from 'mysql2/promise';
import { loginAs, logout } from '../helpers/auth';
import { db } from '../helpers/database';

/**
 * Story 3.4 — Product Detail Page
 *
 * AC1: Given a user clicks on a product from the grid
 *      When the detail page loads
 *      Then they see: photo, name, detailed description, technical specs,
 *           price, seller name, and stock quantity
 *      And the page loads in under 1 second
 *
 * AC2: Given a product is in stock (quantity > 0)
 *      When the detail page is displayed
 *      Then the stock is shown as available with the current quantity
 *
 * AC3: Given a product is out of stock (quantity = 0)
 *      When the detail page is displayed
 *      Then a message shows "Rupture de stock" with the expected return date
 *      And the add-to-cart button is disabled
 *
 * Pre-conditions:
 * - e2e-vendeur@test.com / password exists with role "vendeur" (from E2ETestSeeder)
 * - e2e@test.com / password exists with role "acheteur" (from E2ETestSeeder)
 * - The /products/:id route exists and is publicly accessible (no auth middleware)
 * - Products exist in DB with all required fields (via E2ETestSeeder or seller API)
 *
 * The tests describe EXPECTED behavior (TDD). They will fail until:
 * - Backend: CatalogController@show (GET /api/products/{id}) returns ProductDetailResource
 *            with all fields: photo, name, description, specs, price, seller_name,
 *            stock_quantity, restock_date
 * - Backend: Product includes seller relationship (seller name only)
 * - Backend: Route is public (no auth middleware)
 * - Backend: Returns 404 for non-existent products
 * - Frontend: ProductDetailPage.vue fetches from API (not mock data)
 * - Frontend: Displays photo, name, description, specs table, price, seller, stock status
 * - Frontend: If in stock → shows quantity + enabled "Ajouter au panier" button
 * - Frontend: If out of stock → shows "Rupture de stock" + restock date + disabled button
 * - Frontend: Breadcrumb navigation (Accueil > Catalogue > Product name)
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
// Helper: create a product via seller API and return its DB id
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
const PRODUCT_IN_STOCK_NAME = `E2E-3.4-InStock-${TS}`;
const PRODUCT_OUT_OF_STOCK_NAME = `E2E-3.4-OutOfStock-${TS}`;
const PRODUCT_WITH_SPECS_NAME = `E2E-3.4-Specs-${TS}`;

let productInStockId: number;
let productOutOfStockId: number;
let productWithSpecsId: number;
let vendeurToken: string;

// ---------------------------------------------------------------------------
// Setup: create test products via seller API
// ---------------------------------------------------------------------------
test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  try {
    const auth = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);
    vendeurToken = auth.token;

    // Product 1: In stock (quantity > 0)
    const inStock = await createProductViaSeller(page, vendeurToken, {
      name: PRODUCT_IN_STOCK_NAME,
      description: 'Un processeur haute performance pour le gaming et la productivité. Architecture avancée avec support DDR5 et PCIe 5.0.',
      category: 'cpu',
      price: 549.99,
      stock_quantity: 12,
      is_active: true,
      specs: {
        Marque: 'AMD',
        Modèle: 'Ryzen 9 7950X',
        Socket: 'AM5',
        'Cœurs / Threads': '16 / 32',
        'Fréquence de base': '4.5 GHz',
        'Fréquence boost': '5.7 GHz',
        TDP: '170W',
        Gravure: '5 nm',
      },
    });
    productInStockId = inStock.id;

    // Product 2: Out of stock (quantity = 0) with restock date
    const outOfStock = await createProductViaSeller(page, vendeurToken, {
      name: PRODUCT_OUT_OF_STOCK_NAME,
      description: 'Carte graphique ultime pour le gaming en 4K et le ray tracing. Architecture Ada Lovelace avec DLSS 3.',
      category: 'gpu',
      price: 1799.99,
      stock_quantity: 0,
      is_active: true,
      specs: {
        Marque: 'NVIDIA',
        Modèle: 'GeForce RTX 4090',
        Mémoire: '24 Go GDDR6X',
        'Cœurs CUDA': '16 384',
        TDP: '450W',
      },
      restock_date: '2026-03-15',
    });
    productOutOfStockId = outOfStock.id;

    // Product 3: Product with many specs (to test specs table thoroughly)
    const withSpecs = await createProductViaSeller(page, vendeurToken, {
      name: PRODUCT_WITH_SPECS_NAME,
      description: 'Barrette mémoire DDR5 haute fréquence pour configurations gaming et workstation.',
      category: 'ram',
      price: 189.99,
      stock_quantity: 25,
      is_active: true,
      specs: {
        Marque: 'G.Skill',
        Modèle: 'Trident Z5 RGB',
        Type: 'DDR5',
        Capacité: '32 Go (2x16 Go)',
        Fréquence: '6000 MHz',
        Latence: 'CL30',
        Tension: '1.35V',
      },
    });
    productWithSpecsId = withSpecs.id;
  } finally {
    await page.close();
  }
});

// ---------------------------------------------------------------------------
// Cleanup: delete test products and close DB pool
// ---------------------------------------------------------------------------
test.afterAll(async () => {
  await db.query('DELETE FROM products WHERE name LIKE ?', ['E2E-3.4-%']);
  await db.cleanup();
});

// ═══════════════════════════════════════════════════════════════════════════
// PREREQUISITE — Page structure, route & navigation
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Story 3.4 — Prerequisite: Page structure & navigation', () => {

  test('product detail page is accessible at /products/{id}', async ({ page }) => {
    // === ACTION ===
    await page.goto(`/products/${productInStockId}`);

    // === VÉRIFICATION UI ===
    await expect(page.locator('[data-testid="product-detail-page"]')).toBeVisible();
  });

  test('product detail page is a public route (no auth required)', async ({ page }) => {
    // === SETUP ===
    // Ensure we are NOT logged in
    await logout(page);

    // === ACTION ===
    await page.goto(`/products/${productInStockId}`);

    // === VÉRIFICATION UI ===
    // Page should load without redirect to login
    await expect(page).toHaveURL(new RegExp(`/products/${productInStockId}`));
    await expect(page.locator('[data-testid="product-detail-page"]')).toBeVisible();
    await expect(page.locator('[data-testid="product-detail-name"]')).toBeVisible();
  });

  test('breadcrumb shows Accueil > Catalogue > Product name', async ({ page }) => {
    // === ACTION ===
    await page.goto(`/products/${productInStockId}`);

    // === VÉRIFICATION UI ===
    const breadcrumb = page.locator('[data-testid="product-detail-breadcrumb"]');
    await expect(breadcrumb).toBeVisible();

    // Home link
    const homeLink = page.locator('[data-testid="breadcrumb-home-link"]');
    await expect(homeLink).toBeVisible();
    await expect(homeLink).toContainText('Accueil');

    // Catalogue link
    const catalogueLink = page.locator('[data-testid="breadcrumb-catalogue-link"]');
    await expect(catalogueLink).toBeVisible();
    await expect(catalogueLink).toContainText('Catalogue');

    // Current product name in breadcrumb
    const current = page.locator('[data-testid="breadcrumb-current"]');
    await expect(current).toBeVisible();
    await expect(current).toContainText(PRODUCT_IN_STOCK_NAME);
  });

  test('breadcrumb home link navigates to /', async ({ page }) => {
    // === SETUP ===
    await page.goto(`/products/${productInStockId}`);

    // === ACTION ===
    await page.locator('[data-testid="breadcrumb-home-link"]').click();

    // === VÉRIFICATION UI ===
    await page.waitForURL('**/');
    await expect(page).toHaveURL('/');
  });

  test('breadcrumb catalogue link navigates to /catalogue', async ({ page }) => {
    // === SETUP ===
    await page.goto(`/products/${productInStockId}`);

    // === ACTION ===
    await page.locator('[data-testid="breadcrumb-catalogue-link"]').click();

    // === VÉRIFICATION UI ===
    await page.waitForURL('**/catalogue');
    await expect(page).toHaveURL('/catalogue');
  });

  test('back link navigates to /catalogue', async ({ page }) => {
    // === SETUP ===
    await page.goto(`/products/${productInStockId}`);

    // === ACTION ===
    await page.locator('[data-testid="product-detail-back-link"]').click();

    // === VÉRIFICATION UI ===
    await page.waitForURL('**/catalogue');
    await expect(page).toHaveURL('/catalogue');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// AC1 — Detail page displays all required fields (photo, name, description,
//        technical specs, price, seller name, stock quantity)
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Story 3.4 — AC1: Product detail page shows all required fields', () => {

  test('page displays the product photo area', async ({ page }) => {
    // === ACTION ===
    await page.goto(`/products/${productInStockId}`);

    // === VÉRIFICATION UI ===
    const imageArea = page.locator('[data-testid="product-detail-image"]');
    await expect(imageArea).toBeVisible();
  });

  test('page displays the product name', async ({ page }) => {
    // === ACTION ===
    await page.goto(`/products/${productInStockId}`);

    // === VÉRIFICATION UI ===
    const nameEl = page.locator('[data-testid="product-detail-name"]');
    await expect(nameEl).toBeVisible();
    await expect(nameEl).toContainText(PRODUCT_IN_STOCK_NAME);
  });

  test('page displays the detailed description', async ({ page }) => {
    // === ACTION ===
    await page.goto(`/products/${productInStockId}`);

    // === VÉRIFICATION UI ===
    const descEl = page.locator('[data-testid="product-detail-description"]');
    await expect(descEl).toBeVisible();
    const descText = await descEl.textContent();
    // Description should be non-empty and contain meaningful text
    expect(descText!.trim().length).toBeGreaterThan(20);
    // Verify it contains part of the expected description
    expect(descText).toContain('processeur');
  });

  test('page displays the price formatted in EUR', async ({ page }) => {
    // === ACTION ===
    await page.goto(`/products/${productInStockId}`);

    // === VÉRIFICATION UI ===
    const priceEl = page.locator('[data-testid="product-detail-price"]');
    await expect(priceEl).toBeVisible();
    const priceText = await priceEl.textContent();

    // French locale EUR format: "549,99 €"
    expect(priceText).toMatch(/\d/);
    expect(priceText).toMatch(/€/);
    expect(priceText).toMatch(/549,99/);
  });

  test('page displays the seller name', async ({ page }) => {
    // === ACTION ===
    await page.goto(`/products/${productInStockId}`);

    // === VÉRIFICATION UI ===
    const sellerEl = page.locator('[data-testid="product-detail-seller"]');
    await expect(sellerEl).toBeVisible();
    await expect(sellerEl).toContainText('Vendu par');

    // The seller name itself should be non-empty
    const sellerText = await sellerEl.textContent();
    const sellerName = sellerText!.replace('Vendu par', '').trim();
    expect(sellerName.length).toBeGreaterThan(0);
  });

  test('page displays the stock status section', async ({ page }) => {
    // === ACTION ===
    await page.goto(`/products/${productInStockId}`);

    // === VÉRIFICATION UI ===
    await expect(page.locator('[data-testid="product-detail-stock-status"]')).toBeVisible();
  });

  test('page displays the technical specs table', async ({ page }) => {
    // === ACTION ===
    await page.goto(`/products/${productInStockId}`);

    // === VÉRIFICATION UI ===
    await expect(page.locator('[data-testid="product-specs-section"]')).toBeVisible();
    await expect(page.locator('[data-testid="product-specs-table"]')).toBeVisible();
  });

  test('page displays add-to-cart button', async ({ page }) => {
    // === ACTION ===
    await page.goto(`/products/${productInStockId}`);

    // === VÉRIFICATION UI ===
    await expect(page.locator('[data-testid="product-detail-add-cart-btn"]')).toBeVisible();
  });

  test('page displays the content container with all sections', async ({ page }) => {
    // === ACTION ===
    await page.goto(`/products/${productInStockId}`);

    // === VÉRIFICATION UI ===
    // The content block holds the entire product detail
    await expect(page.locator('[data-testid="product-detail-content"]')).toBeVisible();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// AC1 — Technical specs displayed as key/value table
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Story 3.4 — AC1: Technical specs as key/value table', () => {

  test('specs table has at least one row', async ({ page }) => {
    // === ACTION ===
    await page.goto(`/products/${productInStockId}`);

    // === VÉRIFICATION UI ===
    const rows = page.locator('[data-testid^="product-spec-row-"]');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
  });

  test('each spec row displays a key and a value', async ({ page }) => {
    // === ACTION ===
    await page.goto(`/products/${productInStockId}`);

    // === VÉRIFICATION UI ===
    // Check first spec row has key and value
    const keyEl = page.locator('[data-testid="product-spec-key-0"]');
    const valueEl = page.locator('[data-testid="product-spec-value-0"]');

    await expect(keyEl).toBeVisible();
    await expect(valueEl).toBeVisible();

    const keyText = await keyEl.textContent();
    const valueText = await valueEl.textContent();
    expect(keyText!.trim().length).toBeGreaterThan(0);
    expect(valueText!.trim().length).toBeGreaterThan(0);
  });

  test('specs table shows all expected specs from product data', async ({ page }) => {
    // === ACTION ===
    await page.goto(`/products/${productInStockId}`);

    // === VÉRIFICATION UI ===
    // Product was created with 8 specs (Marque, Modèle, Socket, etc.)
    const rows = page.locator('[data-testid^="product-spec-row-"]');
    const count = await rows.count();
    expect(count).toBe(8);

    // Verify known spec keys are present
    const specKeys: string[] = [];
    for (let i = 0; i < count; i++) {
      const keyText = await page.locator(`[data-testid="product-spec-key-${i}"]`).textContent();
      specKeys.push(keyText!.trim());
    }

    expect(specKeys).toContain('Marque');
    expect(specKeys).toContain('Socket');
    expect(specKeys).toContain('TDP');
  });

  test('specs values match expected product data', async ({ page }) => {
    // === ACTION ===
    await page.goto(`/products/${productInStockId}`);

    // === VÉRIFICATION UI ===
    // Find the "Marque" spec and verify its value is "AMD"
    const rows = page.locator('[data-testid^="product-spec-row-"]');
    const count = await rows.count();

    let foundMarque = false;
    for (let i = 0; i < count; i++) {
      const keyText = await page.locator(`[data-testid="product-spec-key-${i}"]`).textContent();
      if (keyText!.trim() === 'Marque') {
        const valueText = await page.locator(`[data-testid="product-spec-value-${i}"]`).textContent();
        expect(valueText!.trim()).toBe('AMD');
        foundMarque = true;
        break;
      }
    }
    expect(foundMarque).toBeTruthy();
  });

  test('product with different specs shows its own spec data', async ({ page }) => {
    // === ACTION ===
    await page.goto(`/products/${productWithSpecsId}`);

    // === VÉRIFICATION UI ===
    const rows = page.locator('[data-testid^="product-spec-row-"]');
    const count = await rows.count();
    // Product 3 was created with 7 specs
    expect(count).toBe(7);

    // Collect all spec keys
    const specKeys: string[] = [];
    for (let i = 0; i < count; i++) {
      const keyText = await page.locator(`[data-testid="product-spec-key-${i}"]`).textContent();
      specKeys.push(keyText!.trim());
    }

    expect(specKeys).toContain('Type');
    expect(specKeys).toContain('Capacité');
    expect(specKeys).toContain('Fréquence');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// AC1 — Page loads in under 1 second (NFR2)
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Story 3.4 — AC1: Performance — page loads in under 1 second (NFR2)', () => {

  test('product detail page loads in under 1 second', async ({ page }) => {
    // === SETUP ===
    const startTime = Date.now();

    // === ACTION ===
    await page.goto(`/products/${productInStockId}`);

    // Wait for the product name to be visible (page fully loaded)
    await expect(page.locator('[data-testid="product-detail-name"]')).toBeVisible();

    // === VÉRIFICATION PERFORMANCE ===
    const loadTime = Date.now() - startTime;
    expect(loadTime).toBeLessThan(1000);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// AC1 — Data integrity: API returns correct data matching DB
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Story 3.4 — AC1: Data integrity — UI matches database', () => {

  test('displayed product name matches database', async ({ page }) => {
    // === SETUP ===
    const dbProduct = await db.assertExists('products', { id: productInStockId });

    // === ACTION ===
    await page.goto(`/products/${productInStockId}`);

    // === VÉRIFICATION UI ===
    await expect(page.locator('[data-testid="product-detail-name"]')).toContainText(dbProduct.name);
  });

  test('displayed price matches database price', async ({ page }) => {
    // === SETUP ===
    const dbProduct = await db.assertExists('products', { id: productInStockId });

    // === ACTION ===
    await page.goto(`/products/${productInStockId}`);

    // === VÉRIFICATION UI ===
    const priceEl = page.locator('[data-testid="product-detail-price"]');
    const priceText = await priceEl.textContent();

    // DB price is 549.99, displayed as "549,99 €" (French locale)
    const dbPriceFormatted = Number(dbProduct.price).toFixed(2).replace('.', ',');
    expect(priceText).toContain(dbPriceFormatted);
  });

  test('displayed stock quantity matches database', async ({ page }) => {
    // === SETUP ===
    const dbProduct = await db.assertExists('products', { id: productInStockId });

    // === ACTION ===
    await page.goto(`/products/${productInStockId}`);

    // === VÉRIFICATION UI ===
    const stockQtyEl = page.locator('[data-testid="product-stock-quantity"]');
    await expect(stockQtyEl).toBeVisible();
    await expect(stockQtyEl).toContainText(String(dbProduct.stock_quantity));
  });

  test('displayed seller name matches the seller in database', async ({ page }) => {
    // === SETUP ===
    // Fetch the product and its seller from DB
    const rows = await db.query(
      `SELECT p.*, u.name AS seller_name
       FROM products p
       JOIN users u ON p.user_id = u.id
       WHERE p.id = ?`,
      [productInStockId]
    );
    expect(rows.length).toBe(1);
    const sellerName = rows[0].seller_name;

    // === ACTION ===
    await page.goto(`/products/${productInStockId}`);

    // === VÉRIFICATION UI ===
    const sellerEl = page.locator('[data-testid="product-detail-seller"]');
    await expect(sellerEl).toContainText(sellerName);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// AC2 — Product in stock: show quantity and available status
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Story 3.4 — AC2: In-stock product shows available status with quantity', () => {

  test('in-stock product shows "En stock" badge', async ({ page }) => {
    // === ACTION ===
    await page.goto(`/products/${productInStockId}`);

    // === VÉRIFICATION UI ===
    await expect(page.locator('[data-testid="product-stock-available"]')).toBeVisible();
    await expect(page.locator('[data-testid="product-stock-unavailable"]')).not.toBeVisible();
  });

  test('in-stock product shows the exact stock quantity', async ({ page }) => {
    // === ACTION ===
    await page.goto(`/products/${productInStockId}`);

    // === VÉRIFICATION UI ===
    const stockQtyEl = page.locator('[data-testid="product-stock-quantity"]');
    await expect(stockQtyEl).toBeVisible();
    // Product was created with stock_quantity = 12
    await expect(stockQtyEl).toContainText('12');
  });

  test('in-stock product shows stock text with "unités disponibles"', async ({ page }) => {
    // === ACTION ===
    await page.goto(`/products/${productInStockId}`);

    // === VÉRIFICATION UI ===
    const stockBadge = page.locator('[data-testid="product-stock-available"]');
    await expect(stockBadge).toBeVisible();
    const stockText = await stockBadge.textContent();
    // Should contain "En stock" and "disponible(s)"
    expect(stockText).toMatch(/En stock/i);
    expect(stockText).toMatch(/disponible/i);
  });

  test('in-stock product has "Ajouter au panier" button ENABLED', async ({ page }) => {
    // === ACTION ===
    await page.goto(`/products/${productInStockId}`);

    // === VÉRIFICATION UI ===
    const addToCartBtn = page.locator('[data-testid="product-detail-add-cart-btn"]');
    await expect(addToCartBtn).toBeVisible();
    await expect(addToCartBtn).not.toBeDisabled();
    await expect(addToCartBtn).toContainText('Ajouter au panier');
  });

  test('in-stock product does NOT show "Rupture de stock" message', async ({ page }) => {
    // === ACTION ===
    await page.goto(`/products/${productInStockId}`);

    // === VÉRIFICATION UI ===
    await expect(page.locator('[data-testid="product-out-of-stock-message"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="product-restock-date"]')).not.toBeVisible();
  });

  test('in-stock product does NOT show restock date', async ({ page }) => {
    // === ACTION ===
    await page.goto(`/products/${productInStockId}`);

    // === VÉRIFICATION UI ===
    await expect(page.locator('[data-testid="product-restock-date"]')).not.toBeVisible();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// AC3 — Product out of stock: "Rupture de stock", restock date, disabled button
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Story 3.4 — AC3: Out-of-stock product shows "Rupture de stock"', () => {

  test('out-of-stock product shows "Rupture de stock" message', async ({ page }) => {
    // === ACTION ===
    await page.goto(`/products/${productOutOfStockId}`);

    // === VÉRIFICATION UI ===
    await expect(page.locator('[data-testid="product-stock-unavailable"]')).toBeVisible();
    const message = page.locator('[data-testid="product-out-of-stock-message"]');
    await expect(message).toBeVisible();
    await expect(message).toContainText('Rupture de stock');
  });

  test('out-of-stock product does NOT show "En stock" badge', async ({ page }) => {
    // === ACTION ===
    await page.goto(`/products/${productOutOfStockId}`);

    // === VÉRIFICATION UI ===
    await expect(page.locator('[data-testid="product-stock-available"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="product-stock-quantity"]')).not.toBeVisible();
  });

  test('out-of-stock product shows the expected restock date', async ({ page }) => {
    // === ACTION ===
    await page.goto(`/products/${productOutOfStockId}`);

    // === VÉRIFICATION UI ===
    const restockEl = page.locator('[data-testid="product-restock-date"]');
    await expect(restockEl).toBeVisible();
    const restockText = await restockEl.textContent();

    // restock_date was set to "2026-03-15" → French format: "15 mars 2026"
    expect(restockText).toMatch(/15/);
    expect(restockText).toMatch(/mars/i);
    expect(restockText).toMatch(/2026/);
    // Should contain "Retour prévu" or similar phrasing
    expect(restockText).toMatch(/Retour prévu/i);
  });

  test('out-of-stock product has add-to-cart button DISABLED', async ({ page }) => {
    // === ACTION ===
    await page.goto(`/products/${productOutOfStockId}`);

    // === VÉRIFICATION UI ===
    const addToCartBtn = page.locator('[data-testid="product-detail-add-cart-btn"]');
    await expect(addToCartBtn).toBeVisible();
    await expect(addToCartBtn).toBeDisabled();
  });

  test('out-of-stock button shows "Indisponible" text', async ({ page }) => {
    // === ACTION ===
    await page.goto(`/products/${productOutOfStockId}`);

    // === VÉRIFICATION UI ===
    const addToCartBtn = page.locator('[data-testid="product-detail-add-cart-btn"]');
    await expect(addToCartBtn).toContainText('Indisponible');
  });

  test('out-of-stock product still displays all other fields (name, description, price, seller, specs)', async ({ page }) => {
    // === ACTION ===
    await page.goto(`/products/${productOutOfStockId}`);

    // === VÉRIFICATION UI ===
    // All fields must be visible even when out of stock
    await expect(page.locator('[data-testid="product-detail-name"]')).toBeVisible();
    await expect(page.locator('[data-testid="product-detail-name"]')).toContainText(PRODUCT_OUT_OF_STOCK_NAME);

    await expect(page.locator('[data-testid="product-detail-description"]')).toBeVisible();
    const descText = await page.locator('[data-testid="product-detail-description"]').textContent();
    expect(descText!.trim().length).toBeGreaterThan(20);

    await expect(page.locator('[data-testid="product-detail-price"]')).toBeVisible();
    const priceText = await page.locator('[data-testid="product-detail-price"]').textContent();
    expect(priceText).toContain('€');
    // 1799.99 → "1 799,99"
    expect(priceText).toMatch(/1[\s\u202f]?799,99/);

    await expect(page.locator('[data-testid="product-detail-seller"]')).toBeVisible();
    await expect(page.locator('[data-testid="product-detail-seller"]')).toContainText('Vendu par');

    await expect(page.locator('[data-testid="product-specs-section"]')).toBeVisible();
    await expect(page.locator('[data-testid="product-specs-table"]')).toBeVisible();

    await expect(page.locator('[data-testid="product-detail-image"]')).toBeVisible();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Edge case — Product not found (404)
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Story 3.4 — Edge case: Product not found (404)', () => {

  test('navigating to a non-existent product shows "Produit introuvable"', async ({ page }) => {
    // === ACTION ===
    await page.goto('/products/999999');

    // === VÉRIFICATION UI ===
    await expect(page.locator('[data-testid="product-not-found"]')).toBeVisible();
    // Product detail content should NOT be visible
    await expect(page.locator('[data-testid="product-detail-content"]')).not.toBeVisible();
  });

  test('not-found page shows a link back to catalogue', async ({ page }) => {
    // === ACTION ===
    await page.goto('/products/999999');

    // === VÉRIFICATION UI ===
    const catalogueLink = page.locator('[data-testid="not-found-catalogue-link"]');
    await expect(catalogueLink).toBeVisible();
    await expect(catalogueLink).toContainText('Retour au catalogue');
  });

  test('not-found catalogue link navigates to /catalogue', async ({ page }) => {
    // === SETUP ===
    await page.goto('/products/999999');

    // === ACTION ===
    await page.locator('[data-testid="not-found-catalogue-link"]').click();

    // === VÉRIFICATION UI ===
    await page.waitForURL('**/catalogue');
    await expect(page).toHaveURL('/catalogue');
  });

  test('navigating to an invalid product ID (non-numeric) shows not-found', async ({ page }) => {
    // === ACTION ===
    await page.goto('/products/abc');

    // === VÉRIFICATION UI ===
    await expect(page.locator('[data-testid="product-not-found"]')).toBeVisible();
    await expect(page.locator('[data-testid="product-detail-content"]')).not.toBeVisible();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Edge case — Inactive product should not be visible
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Story 3.4 — Edge case: Inactive product', () => {
  let inactiveProductId: number;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    try {
      const auth = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);

      // Create an inactive product
      const inactive = await createProductViaSeller(page, auth.token, {
        name: `E2E-3.4-Inactive-${TS}`,
        description: 'This product is inactive and should not appear in public detail.',
        category: 'cpu',
        price: 99.99,
        stock_quantity: 5,
        is_active: false,
      });
      inactiveProductId = inactive.id;
    } finally {
      await page.close();
    }
  });

  test('inactive product returns not-found on detail page', async ({ page }) => {
    // === ACTION ===
    await page.goto(`/products/${inactiveProductId}`);

    // === VÉRIFICATION UI ===
    // An inactive product should NOT be accessible publicly
    await expect(page.locator('[data-testid="product-not-found"]')).toBeVisible();
    await expect(page.locator('[data-testid="product-detail-content"]')).not.toBeVisible();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Access control — All roles can view the product detail page
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Story 3.4 — Access control: All roles can view product detail', () => {

  test('visitor (not logged in) can access product detail page', async ({ page }) => {
    // === SETUP ===
    await logout(page);

    // === ACTION ===
    await page.goto(`/products/${productInStockId}`);

    // === VÉRIFICATION UI ===
    await expect(page.locator('[data-testid="product-detail-page"]')).toBeVisible();
    await expect(page.locator('[data-testid="product-detail-name"]')).toContainText(PRODUCT_IN_STOCK_NAME);
  });

  test('acheteur can access product detail page', async ({ page }) => {
    // === SETUP ===
    await loginAs(page, ACHETEUR_EMAIL, ACHETEUR_PASSWORD);

    // === ACTION ===
    await page.goto(`/products/${productInStockId}`);

    // === VÉRIFICATION UI ===
    await expect(page.locator('[data-testid="product-detail-page"]')).toBeVisible();
    await expect(page.locator('[data-testid="product-detail-name"]')).toContainText(PRODUCT_IN_STOCK_NAME);
  });

  test('vendeur can access product detail page', async ({ page }) => {
    // === SETUP ===
    await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);

    // === ACTION ===
    await page.goto(`/products/${productInStockId}`);

    // === VÉRIFICATION UI ===
    await expect(page.locator('[data-testid="product-detail-page"]')).toBeVisible();
    await expect(page.locator('[data-testid="product-detail-name"]')).toContainText(PRODUCT_IN_STOCK_NAME);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// AC1 — Navigation from product grid to detail page
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Story 3.4 — AC1: Navigation from product grid to detail page', () => {

  test('clicking a product card in the grid navigates to the detail page with correct data', async ({ page }) => {
    // === SETUP ===
    // Navigate to the category that has our test product
    await page.goto('/categories/cpu');
    await expect(page.locator('[data-testid="product-grid-loading"]')).not.toBeVisible({ timeout: 5_000 });

    // Find our test product card
    const testProductCard = page.locator(`[data-testid="product-card-${productInStockId}"]`);

    // If the test product is visible in the grid, click it
    // (it may not be on the first page; skip if not found)
    const isVisible = await testProductCard.isVisible().catch(() => false);
    if (!isVisible) {
      test.skip();
      return;
    }

    // === ACTION ===
    await testProductCard.click();

    // === VÉRIFICATION UI ===
    await page.waitForURL(`**/products/${productInStockId}`);
    await expect(page.locator('[data-testid="product-detail-page"]')).toBeVisible();
    await expect(page.locator('[data-testid="product-detail-name"]')).toContainText(PRODUCT_IN_STOCK_NAME);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// API contract — Backend endpoint returns expected structure
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Story 3.4 — API contract: GET /api/products/{id}', () => {

  test('API returns 200 with product data for existing product', async ({ request }) => {
    // === ACTION ===
    const response = await request.get(`${API_URL}/products/${productInStockId}`, {
      headers: { Accept: 'application/json' },
    });

    // === VÉRIFICATION API ===
    expect(response.status()).toBe(200);
    const json = await response.json();
    expect(json).toHaveProperty('data');
    expect(json.data).toHaveProperty('id', productInStockId);
    expect(json.data).toHaveProperty('name', PRODUCT_IN_STOCK_NAME);
    expect(json.data).toHaveProperty('description');
    expect(json.data).toHaveProperty('price');
    expect(json.data).toHaveProperty('stock_quantity');
    expect(json.data).toHaveProperty('seller_name');
    expect(json.data).toHaveProperty('specs');
    expect(json.data).toHaveProperty('photo_url');
  });

  test('API returns product with restock_date field (null for in-stock)', async ({ request }) => {
    // === ACTION ===
    const response = await request.get(`${API_URL}/products/${productInStockId}`, {
      headers: { Accept: 'application/json' },
    });

    // === VÉRIFICATION API ===
    const json = await response.json();
    expect(json.data).toHaveProperty('restock_date');
    // In-stock product has no restock date
    expect(json.data.restock_date).toBeNull();
  });

  test('API returns product with restock_date for out-of-stock product', async ({ request }) => {
    // === ACTION ===
    const response = await request.get(`${API_URL}/products/${productOutOfStockId}`, {
      headers: { Accept: 'application/json' },
    });

    // === VÉRIFICATION API ===
    const json = await response.json();
    expect(json.data).toHaveProperty('restock_date');
    expect(json.data.restock_date).toBeTruthy();
    // Verify it matches the date we set
    expect(json.data.restock_date).toContain('2026-03-15');
  });

  test('API returns specs as array of key/value objects', async ({ request }) => {
    // === ACTION ===
    const response = await request.get(`${API_URL}/products/${productInStockId}`, {
      headers: { Accept: 'application/json' },
    });

    // === VÉRIFICATION API ===
    const json = await response.json();
    const specs = json.data.specs;
    expect(Array.isArray(specs)).toBeTruthy();
    expect(specs.length).toBeGreaterThan(0);

    // Each spec should have key and value
    for (const spec of specs) {
      expect(spec).toHaveProperty('key');
      expect(spec).toHaveProperty('value');
      expect(typeof spec.key).toBe('string');
      expect(typeof spec.value).toBe('string');
    }
  });

  test('API returns seller_name as a string (not an object)', async ({ request }) => {
    // === ACTION ===
    const response = await request.get(`${API_URL}/products/${productInStockId}`, {
      headers: { Accept: 'application/json' },
    });

    // === VÉRIFICATION API ===
    const json = await response.json();
    expect(typeof json.data.seller_name).toBe('string');
    expect(json.data.seller_name.length).toBeGreaterThan(0);
  });

  test('API returns 404 for non-existent product', async ({ request }) => {
    // === ACTION ===
    const response = await request.get(`${API_URL}/products/999999`, {
      headers: { Accept: 'application/json' },
    });

    // === VÉRIFICATION API ===
    expect(response.status()).toBe(404);
  });

  test('API is accessible without authentication (public route)', async ({ request }) => {
    // === ACTION ===
    // No Authorization header
    const response = await request.get(`${API_URL}/products/${productInStockId}`, {
      headers: { Accept: 'application/json' },
    });

    // === VÉRIFICATION API ===
    expect(response.status()).toBe(200);
    const json = await response.json();
    expect(json.data).toHaveProperty('name', PRODUCT_IN_STOCK_NAME);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// DB verification — Product data integrity
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Story 3.4 — DB verification: Product data integrity', () => {

  test('in-stock test product exists in database with correct fields', async () => {
    // === VÉRIFICATION DB ===
    const product = await db.assertExists('products', { id: productInStockId });
    expect(product.name).toBe(PRODUCT_IN_STOCK_NAME);
    expect(Number(product.price)).toBe(549.99);
    expect(product.stock_quantity).toBe(12);
    expect(product.is_active).toBeTruthy();
    expect(product.category).toBe('cpu');
  });

  test('out-of-stock test product exists in database with correct fields', async () => {
    // === VÉRIFICATION DB ===
    const product = await db.assertExists('products', { id: productOutOfStockId });
    expect(product.name).toBe(PRODUCT_OUT_OF_STOCK_NAME);
    expect(Number(product.price)).toBe(1799.99);
    expect(product.stock_quantity).toBe(0);
    expect(product.is_active).toBeTruthy();
    expect(product.category).toBe('gpu');
  });

  test('product has a valid user_id (seller foreign key)', async () => {
    // === VÉRIFICATION DB ===
    const product = await db.assertExists('products', { id: productInStockId });
    expect(product.user_id).toBeDefined();
    expect(product.user_id).toBeGreaterThan(0);

    // Verify the seller (user) actually exists — no orphan
    const seller = await db.assertExists('users', { id: product.user_id });
    expect(seller.email).toBe(VENDEUR_EMAIL);
  });

  test('product description is stored and non-empty', async () => {
    // === VÉRIFICATION DB ===
    const product = await db.assertExists('products', { id: productInStockId });
    expect(product.description).toBeDefined();
    expect(product.description.length).toBeGreaterThan(20);
  });
});
