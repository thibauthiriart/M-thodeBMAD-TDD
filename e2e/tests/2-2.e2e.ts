import { test, expect, Page } from '@playwright/test';
import { loginAs, logout } from '../helpers/auth';
import { db } from '../helpers/database';
import path from 'path';

/**
 * Story 2.2 — Create Product Listing
 *
 * AC1: Given a seller clicks "Add product" from their dashboard
 *      When the creation form loads
 *      Then they see fields for: photo upload, name, description, technical specs,
 *           price, stock quantity, and category selection
 *           (CPU, GPU, RAM, Stockage, CM, Alimentation, Boitier, Peripheriques)
 *
 * AC2: Given a seller fills in all required fields and submits
 *      When the form is valid
 *      Then the product is created with status "active",
 *           the image is stored via scalable storage,
 *           and the seller is redirected to their dashboard with a success message
 *
 * AC3: Given a seller submits an incomplete form (missing required fields)
 *      When the form is submitted
 *      Then validation errors are displayed for each missing field
 *
 * Pre-conditions:
 * - e2e-vendeur@test.com / password exists with role "vendeur" (from E2ETestSeeder)
 * - e2e@test.com / password exists with role "acheteur" (from E2ETestSeeder)
 * - e2e-admin@test.com / password exists with role "admin" (from E2ETestSeeder)
 *
 * The tests describe EXPECTED behavior (TDD). They will fail until:
 * - Backend: Product model + migration created with all fields
 * - Backend: SellerProductController@store (POST /api/seller/products) implemented
 * - Backend: StoreProductRequest Form Request with validation rules
 * - Backend: Photo upload to storage (local disk for MVP, S3-ready)
 * - Frontend: ProductFormPage.vue wired to real API via multipart/form-data
 * - Frontend: Redirect to dashboard on success with success message
 * - Frontend: Server-side validation errors displayed per field
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

const API_URL = process.env.API_URL || 'http://localhost:8080/api';

// ---------------------------------------------------------------------------
// Category enum values matching backend + frontend
// ---------------------------------------------------------------------------
const PRODUCT_CATEGORIES = [
  'cpu',
  'gpu',
  'ram',
  'stockage',
  'cm',
  'alimentation',
  'boitier',
  'peripheriques',
] as const;

const PRODUCT_CATEGORY_LABELS: Record<string, string> = {
  cpu: 'CPU',
  gpu: 'GPU',
  ram: 'RAM',
  stockage: 'Stockage',
  cm: 'Carte Mère',
  alimentation: 'Alimentation',
  boitier: 'Boîtier',
  peripheriques: 'Périphériques',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Generate a unique product name for test isolation */
function uniqueProductName(label: string): string {
  return `E2E-2.2-${label}-${Date.now()}`;
}

/**
 * Create a minimal test image file (1x1 PNG) for photo upload tests.
 * Returns the path to a tiny PNG buffer that Playwright can use with setInputFiles.
 */
function createTestImageBuffer(): Buffer {
  // Minimal 1x1 red PNG (67 bytes)
  return Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
    'base64'
  );
}

/**
 * Fill the product form with valid data.
 * Does NOT submit — call page.click on submit button separately.
 */
async function fillValidProductForm(
  page: Page,
  overrides?: {
    name?: string;
    description?: string;
    category?: string;
    price?: string;
    stock?: string;
    skipPhoto?: boolean;
    specs?: Array<{ key: string; value: string }>;
  }
): Promise<{ name: string }> {
  const productName = overrides?.name ?? uniqueProductName('Valid');

  // Photo upload (unless skipped)
  if (!overrides?.skipPhoto) {
    const fileInput = page.locator('[data-testid="photo-input"]');
    await fileInput.setInputFiles({
      name: 'test-product.png',
      mimeType: 'image/png',
      buffer: createTestImageBuffer(),
    });
  }

  // Name
  await page.locator('[data-testid="product-name-input"]').fill(productName);

  // Description
  await page
    .locator('[data-testid="product-description-input"]')
    .fill(overrides?.description ?? 'Processeur haute performance pour gaming et workstation.');

  // Category
  await page
    .locator('[data-testid="product-category-select"]')
    .selectOption(overrides?.category ?? 'cpu');

  // Price
  await page
    .locator('[data-testid="product-price-input"]')
    .fill(overrides?.price ?? '599.99');

  // Stock
  await page
    .locator('[data-testid="product-stock-input"]')
    .fill(overrides?.stock ?? '25');

  // Specs (optional)
  if (overrides?.specs) {
    for (let i = 0; i < overrides.specs.length; i++) {
      // Add spec row if needed (first row already exists)
      if (i > 0) {
        await page.locator('[data-testid="spec-add-btn"]').click();
      }
      await page.locator(`[data-testid="spec-key-input-${i}"]`).fill(overrides.specs[i].key);
      await page.locator(`[data-testid="spec-value-input-${i}"]`).fill(overrides.specs[i].value);
    }
  }

  return { name: productName };
}

// ---------------------------------------------------------------------------
// Setup & Cleanup
// ---------------------------------------------------------------------------

test.afterAll(async () => {
  // Cleanup test products created during tests
  await db.query('DELETE FROM products WHERE name LIKE ?', ['E2E-2.2-%']);
  await db.cleanup();
});

// ===========================================================================
// AC1 — FORM STRUCTURE: seller sees all required form fields
// ===========================================================================

test.describe('Story 2.2 — AC1: Product creation form structure', () => {
  test('form is accessible at /seller/products/create for vendeur', async ({ page }) => {
    // === SETUP ===
    await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);

    // === ACTION ===
    await page.goto('/seller/products/create');

    // === VÉRIFICATION UI ===
    await page.waitForURL('**/seller/products/create');
    await expect(page.locator('[data-testid="product-form-title"]')).toBeVisible();
    await expect(page.locator('[data-testid="product-form-title"]')).toHaveText('Ajouter un produit');
  });

  test('form subtitle describes the purpose', async ({ page }) => {
    // === SETUP ===
    await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);

    // === ACTION ===
    await page.goto('/seller/products/create');

    // === VÉRIFICATION UI ===
    await expect(page.locator('[data-testid="product-form-subtitle"]')).toBeVisible();
    const subtitle = await page.locator('[data-testid="product-form-subtitle"]').textContent();
    expect(subtitle!.length).toBeGreaterThan(10);
  });

  test('form contains photo upload zone', async ({ page }) => {
    // === SETUP ===
    await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);

    // === ACTION ===
    await page.goto('/seller/products/create');

    // === VÉRIFICATION UI ===
    await expect(page.locator('[data-testid="photo-upload-zone"]')).toBeVisible();
    await expect(page.locator('[data-testid="photo-input"]')).toBeAttached();
  });

  test('form contains name input field', async ({ page }) => {
    // === SETUP ===
    await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);

    // === ACTION ===
    await page.goto('/seller/products/create');

    // === VÉRIFICATION UI ===
    await expect(page.locator('[data-testid="product-name-input"]')).toBeVisible();
    // Verify it's a text input
    await expect(page.locator('[data-testid="product-name-input"]')).toHaveAttribute('type', 'text');
  });

  test('form contains description textarea', async ({ page }) => {
    // === SETUP ===
    await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);

    // === ACTION ===
    await page.goto('/seller/products/create');

    // === VÉRIFICATION UI ===
    const descInput = page.locator('[data-testid="product-description-input"]');
    await expect(descInput).toBeVisible();
    // Should be a textarea element
    await expect(descInput).toHaveAttribute('rows', '4');
  });

  test('form contains category select with all 8 categories', async ({ page }) => {
    // === SETUP ===
    await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);

    // === ACTION ===
    await page.goto('/seller/products/create');

    // === VÉRIFICATION UI ===
    const select = page.locator('[data-testid="product-category-select"]');
    await expect(select).toBeVisible();

    // All 8 categories should be available as options
    for (const cat of PRODUCT_CATEGORIES) {
      await expect(
        page.locator(`[data-testid="product-category-option-${cat}"]`)
      ).toBeAttached();
    }

    // Verify labels match expected French names
    for (const cat of PRODUCT_CATEGORIES) {
      const option = page.locator(`[data-testid="product-category-option-${cat}"]`);
      await expect(option).toHaveText(PRODUCT_CATEGORY_LABELS[cat]);
    }
  });

  test('form contains price input field (number type)', async ({ page }) => {
    // === SETUP ===
    await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);

    // === ACTION ===
    await page.goto('/seller/products/create');

    // === VÉRIFICATION UI ===
    const priceInput = page.locator('[data-testid="product-price-input"]');
    await expect(priceInput).toBeVisible();
    await expect(priceInput).toHaveAttribute('type', 'number');
    await expect(priceInput).toHaveAttribute('step', '0.01');
  });

  test('form contains stock quantity input field (number type)', async ({ page }) => {
    // === SETUP ===
    await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);

    // === ACTION ===
    await page.goto('/seller/products/create');

    // === VÉRIFICATION UI ===
    const stockInput = page.locator('[data-testid="product-stock-input"]');
    await expect(stockInput).toBeVisible();
    await expect(stockInput).toHaveAttribute('type', 'number');
    await expect(stockInput).toHaveAttribute('min', '0');
  });

  test('form contains technical specs section with add button', async ({ page }) => {
    // === SETUP ===
    await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);

    // === ACTION ===
    await page.goto('/seller/products/create');

    // === VÉRIFICATION UI ===
    await expect(page.locator('[data-testid="spec-add-btn"]')).toBeVisible();
    // Initial spec row should exist
    await expect(page.locator('[data-testid="spec-row-0"]')).toBeVisible();
    await expect(page.locator('[data-testid="spec-key-input-0"]')).toBeVisible();
    await expect(page.locator('[data-testid="spec-value-input-0"]')).toBeVisible();
  });

  test('form contains submit and cancel buttons', async ({ page }) => {
    // === SETUP ===
    await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);

    // === ACTION ===
    await page.goto('/seller/products/create');

    // === VÉRIFICATION UI ===
    await expect(page.locator('[data-testid="product-submit-btn"]')).toBeVisible();
    await expect(page.locator('[data-testid="product-submit-btn"]')).toContainText(/créer le produit/i);

    await expect(page.locator('[data-testid="product-cancel-btn"]')).toBeVisible();
    await expect(page.locator('[data-testid="product-cancel-btn"]')).toHaveText('Annuler');
  });
});

// ===========================================================================
// AC1 — NAVIGATION: seller accesses form from dashboard
// ===========================================================================

test.describe('Story 2.2 — AC1: Navigation from dashboard to creation form', () => {
  test('"Ajouter un produit" button on dashboard navigates to creation form', async ({ page }) => {
    // === SETUP ===
    await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);

    // === ACTION ===
    await page.goto('/seller/dashboard');

    // Try both buttons (empty state CTA or header button)
    const addBtn = page.locator(
      '[data-testid="seller-add-product-btn"], [data-testid="seller-empty-state-add-btn"]'
    );
    await expect(addBtn.first()).toBeVisible();
    await addBtn.first().click();

    // === VÉRIFICATION UI ===
    await page.waitForURL('**/seller/products/create', { timeout: 10_000 });
    await expect(page.locator('[data-testid="product-form-title"]')).toBeVisible();
  });
});

// ===========================================================================
// AC1 — PHOTO UPLOAD: interactions with photo field
// ===========================================================================

test.describe('Story 2.2 — AC1: Photo upload interactions', () => {
  test('uploading a photo shows preview image', async ({ page }) => {
    // === SETUP ===
    await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);
    await page.goto('/seller/products/create');

    // === ACTION ===
    const fileInput = page.locator('[data-testid="photo-input"]');
    await fileInput.setInputFiles({
      name: 'test-photo.png',
      mimeType: 'image/png',
      buffer: createTestImageBuffer(),
    });

    // === VÉRIFICATION UI ===
    await expect(page.locator('[data-testid="photo-preview"]')).toBeVisible();
    await expect(page.locator('[data-testid="photo-preview-img"]')).toBeVisible();
    await expect(page.locator('[data-testid="photo-remove-btn"]')).toBeVisible();
    // Upload zone should be hidden when preview is shown
    await expect(page.locator('[data-testid="photo-upload-zone"]')).not.toBeVisible();
  });

  test('removing photo restores upload zone', async ({ page }) => {
    // === SETUP ===
    await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);
    await page.goto('/seller/products/create');

    // Upload photo first
    const fileInput = page.locator('[data-testid="photo-input"]');
    await fileInput.setInputFiles({
      name: 'test-photo.png',
      mimeType: 'image/png',
      buffer: createTestImageBuffer(),
    });
    await expect(page.locator('[data-testid="photo-preview"]')).toBeVisible();

    // === ACTION ===
    await page.locator('[data-testid="photo-remove-btn"]').click();

    // === VÉRIFICATION UI ===
    await expect(page.locator('[data-testid="photo-preview"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="photo-upload-zone"]')).toBeVisible();
  });
});

// ===========================================================================
// AC1 — SPECS MANAGEMENT: dynamic key/value pairs
// ===========================================================================

test.describe('Story 2.2 — AC1: Technical specs key/value management', () => {
  test('clicking "Ajouter" adds a new spec row', async ({ page }) => {
    // === SETUP ===
    await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);
    await page.goto('/seller/products/create');

    // === ACTION ===
    await page.locator('[data-testid="spec-add-btn"]').click();

    // === VÉRIFICATION UI ===
    await expect(page.locator('[data-testid="spec-row-0"]')).toBeVisible();
    await expect(page.locator('[data-testid="spec-row-1"]')).toBeVisible();
    await expect(page.locator('[data-testid="spec-key-input-1"]')).toBeVisible();
    await expect(page.locator('[data-testid="spec-value-input-1"]')).toBeVisible();
  });

  test('removing a spec row works when multiple rows exist', async ({ page }) => {
    // === SETUP ===
    await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);
    await page.goto('/seller/products/create');

    // Add a second row
    await page.locator('[data-testid="spec-add-btn"]').click();
    await expect(page.locator('[data-testid="spec-row-1"]')).toBeVisible();

    // === ACTION ===
    await page.locator('[data-testid="spec-remove-btn-1"]').click();

    // === VÉRIFICATION UI ===
    await expect(page.locator('[data-testid="spec-row-1"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="spec-row-0"]')).toBeVisible();
  });

  test('remove button is disabled when only one spec row exists', async ({ page }) => {
    // === SETUP ===
    await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);
    await page.goto('/seller/products/create');

    // === VÉRIFICATION UI ===
    await expect(page.locator('[data-testid="spec-remove-btn-0"]')).toBeDisabled();
  });
});

// ===========================================================================
// AC2 — HAPPY PATH: valid form submission creates product
// ===========================================================================

test.describe('Story 2.2 — AC2: Successful product creation', () => {
  test('submitting valid form creates product and shows success message', async ({ page }) => {
    // === SETUP ===
    await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);
    await page.goto('/seller/products/create');

    // === ACTION ===
    const { name: productName } = await fillValidProductForm(page);
    await page.locator('[data-testid="product-submit-btn"]').click();

    // === VÉRIFICATION UI ===
    // Success message should appear
    await expect(page.locator('[data-testid="product-form-success-message"]')).toBeVisible({
      timeout: 10_000,
    });
    const successText = await page
      .locator('[data-testid="product-form-success-message"]')
      .textContent();
    expect(successText).toMatch(/succès|créé/i);

    // === VÉRIFICATION DB ===
    const product = await db.findOne('products', { name: productName });
    expect(product).toBeTruthy();
    expect(product!.is_active).toBeTruthy();
  });

  test('submit button shows spinner during submission', async ({ page }) => {
    // === SETUP ===
    await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);
    await page.goto('/seller/products/create');

    await fillValidProductForm(page);

    // === ACTION ===
    await page.locator('[data-testid="product-submit-btn"]').click();

    // === VÉRIFICATION UI ===
    // Spinner should appear (briefly) during submission
    // The button should be disabled during submission
    await expect(page.locator('[data-testid="product-submit-btn"]')).toBeDisabled();
  });

  test('product is created with correct values in DB', async ({ page }) => {
    // === SETUP ===
    const { userId } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);
    await page.goto('/seller/products/create');

    const productName = uniqueProductName('DB-Values');

    // === ACTION ===
    await fillValidProductForm(page, {
      name: productName,
      description: 'Description de test pour vérification DB',
      category: 'gpu',
      price: '1299.99',
      stock: '42',
      specs: [
        { key: 'VRAM', value: '24 Go' },
        { key: 'TDP', value: '450W' },
      ],
    });
    await page.locator('[data-testid="product-submit-btn"]').click();

    // Wait for success
    await expect(page.locator('[data-testid="product-form-success-message"]')).toBeVisible({
      timeout: 10_000,
    });

    // === VÉRIFICATION DB ===
    const product = await db.findOne('products', { name: productName });
    expect(product).toBeTruthy();
    expect(product!.name).toBe(productName);
    expect(product!.description).toBe('Description de test pour vérification DB');
    expect(product!.category).toBe('gpu');
    expect(Number(product!.price)).toBeCloseTo(1299.99, 2);
    expect(product!.stock_quantity).toBe(42);
    expect(product!.is_active).toBeTruthy();
    expect(product!.user_id).toBe(userId);

    // Specs stored as JSON
    const specs = typeof product!.specs === 'string' ? JSON.parse(product!.specs) : product!.specs;
    expect(specs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'VRAM', value: '24 Go' }),
        expect.objectContaining({ key: 'TDP', value: '450W' }),
      ])
    );
  });

  test('product photo is stored and photo_path is set in DB', async ({ page }) => {
    // === SETUP ===
    await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);
    await page.goto('/seller/products/create');

    const productName = uniqueProductName('Photo-Storage');

    // === ACTION ===
    await fillValidProductForm(page, { name: productName });
    await page.locator('[data-testid="product-submit-btn"]').click();

    // Wait for success
    await expect(page.locator('[data-testid="product-form-success-message"]')).toBeVisible({
      timeout: 10_000,
    });

    // === VÉRIFICATION DB ===
    const product = await db.findOne('products', { name: productName });
    expect(product).toBeTruthy();
    // Photo path should be set (stored via Laravel Storage)
    expect(product!.photo_path).toBeTruthy();
    expect(typeof product!.photo_path).toBe('string');
    expect(product!.photo_path.length).toBeGreaterThan(0);
  });

  test('product is created with status "active" by default', async ({ page }) => {
    // === SETUP ===
    await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);
    await page.goto('/seller/products/create');

    const productName = uniqueProductName('Active-Default');

    // === ACTION ===
    await fillValidProductForm(page, { name: productName });
    await page.locator('[data-testid="product-submit-btn"]').click();

    await expect(page.locator('[data-testid="product-form-success-message"]')).toBeVisible({
      timeout: 10_000,
    });

    // === VÉRIFICATION DB ===
    const product = await db.findOne('products', { name: productName });
    expect(product).toBeTruthy();
    expect(product!.is_active).toBeTruthy();
  });

  test('seller is redirected to dashboard after successful creation', async ({ page }) => {
    // === SETUP ===
    await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);
    await page.goto('/seller/products/create');

    // === ACTION ===
    await fillValidProductForm(page);
    await page.locator('[data-testid="product-submit-btn"]').click();

    // === VÉRIFICATION UI ===
    // After success, seller should be redirected to dashboard
    await page.waitForURL('**/seller/dashboard', { timeout: 15_000 });
    await expect(page.locator('[data-testid="seller-dashboard-title"]')).toBeVisible();
  });

  test('product belongs to the authenticated seller (FK valid)', async ({ page }) => {
    // === SETUP ===
    const { userId } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);
    await page.goto('/seller/products/create');

    const productName = uniqueProductName('FK-Check');

    // === ACTION ===
    await fillValidProductForm(page, { name: productName });
    await page.locator('[data-testid="product-submit-btn"]').click();

    await expect(page.locator('[data-testid="product-form-success-message"]')).toBeVisible({
      timeout: 10_000,
    });

    // === VÉRIFICATION DB ===
    const product = await db.findOne('products', { name: productName });
    expect(product).toBeTruthy();
    expect(product!.user_id).toBe(userId);

    // Verify the user actually exists (no orphan FK)
    const user = await db.findOne('users', { id: product!.user_id });
    expect(user).toBeTruthy();
    expect(user!.role).toBe('vendeur');
  });
});

// ===========================================================================
// AC2 — BACKEND API: POST /api/seller/products
// ===========================================================================

test.describe('Story 2.2 — Backend API: POST /api/seller/products', () => {
  test('API creates product with multipart/form-data and returns 201', async ({ page }) => {
    // === SETUP ===
    const { token, userId } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);
    const productName = uniqueProductName('API-Create');

    // === ACTION ===
    const response = await page.request.post(`${API_URL}/seller/products`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      multipart: {
        name: productName,
        description: 'Test API creation via multipart',
        category: 'ram',
        price: '89.99',
        stock_quantity: '100',
        specs: JSON.stringify([{ key: 'Type', value: 'DDR5' }]),
        photo: {
          name: 'test.png',
          mimeType: 'image/png',
          buffer: createTestImageBuffer(),
        },
      },
    });

    // === VÉRIFICATION API ===
    expect(response.status()).toBe(201);
    const json = await response.json();
    expect(json.data).toBeDefined();
    expect(json.data.name).toBe(productName);
    expect(json.data.id).toBeDefined();

    // === VÉRIFICATION DB ===
    const product = await db.findOne('products', { name: productName });
    expect(product).toBeTruthy();
    expect(product!.user_id).toBe(userId);
    expect(product!.category).toBe('ram');
    expect(Number(product!.price)).toBeCloseTo(89.99, 2);
    expect(product!.stock_quantity).toBe(100);
    expect(product!.is_active).toBeTruthy();
    expect(product!.photo_path).toBeTruthy();
  });

  test('API returns ProductResource with all expected fields', async ({ page }) => {
    // === SETUP ===
    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);
    const productName = uniqueProductName('API-Resource');

    // === ACTION ===
    const response = await page.request.post(`${API_URL}/seller/products`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      multipart: {
        name: productName,
        description: 'Resource shape test',
        category: 'cpu',
        price: '499.99',
        stock_quantity: '10',
        specs: JSON.stringify([]),
        photo: {
          name: 'test.png',
          mimeType: 'image/png',
          buffer: createTestImageBuffer(),
        },
      },
    });

    // === VÉRIFICATION ===
    expect(response.status()).toBe(201);
    const json = await response.json();
    const data = json.data;

    // ProductResource should return these fields
    expect(data).toHaveProperty('id');
    expect(data).toHaveProperty('name');
    expect(data).toHaveProperty('description');
    expect(data).toHaveProperty('category');
    expect(data).toHaveProperty('price');
    expect(data).toHaveProperty('stock_quantity');
    expect(data).toHaveProperty('is_active');
    expect(data).toHaveProperty('photo_url');

    // Type checks
    expect(typeof data.id).toBe('number');
    expect(typeof data.name).toBe('string');
    expect(typeof data.is_active).toBe('boolean');
    expect(data.is_active).toBe(true);
  });

  test('API returns 401 for unauthenticated request', async ({ page }) => {
    // === ACTION ===
    const response = await page.request.post(`${API_URL}/seller/products`, {
      headers: { Accept: 'application/json' },
      multipart: {
        name: 'Unauthorized product',
        description: 'Test',
        category: 'cpu',
        price: '10',
        stock_quantity: '1',
        photo: {
          name: 'test.png',
          mimeType: 'image/png',
          buffer: createTestImageBuffer(),
        },
      },
    });

    // === VÉRIFICATION ===
    expect(response.status()).toBe(401);
  });

  test('API returns 403 for acheteur trying to create product', async ({ page }) => {
    // === SETUP ===
    const { token } = await loginAs(page, ACHETEUR_EMAIL, ACHETEUR_PASSWORD);

    // === ACTION ===
    const response = await page.request.post(`${API_URL}/seller/products`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      multipart: {
        name: 'Acheteur product attempt',
        description: 'Should fail',
        category: 'cpu',
        price: '10',
        stock_quantity: '1',
        photo: {
          name: 'test.png',
          mimeType: 'image/png',
          buffer: createTestImageBuffer(),
        },
      },
    });

    // === VÉRIFICATION ===
    expect(response.status()).toBe(403);

    // === VÉRIFICATION DB ===
    await db.assertNotExists('products', { name: 'Acheteur product attempt' });
  });
});

// ===========================================================================
// AC3 — VALIDATION ERRORS: incomplete/invalid form submission
// ===========================================================================

test.describe('Story 2.2 — AC3: Validation errors on incomplete form', () => {
  test('submitting empty form shows all required field errors', async ({ page }) => {
    // === SETUP ===
    await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);
    await page.goto('/seller/products/create');

    // === ACTION ===
    await page.locator('[data-testid="product-submit-btn"]').click();

    // === VÉRIFICATION UI ===
    // General error banner should appear
    await expect(page.locator('[data-testid="product-form-general-error"]')).toBeVisible();

    // Individual field errors for all required fields
    await expect(page.locator('[data-testid="photo-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="product-name-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="product-description-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="product-category-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="product-price-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="product-stock-error"]')).toBeVisible();

    // Success message should NOT appear
    await expect(page.locator('[data-testid="product-form-success-message"]')).not.toBeVisible();
  });

  test('photo error shows "photo requise" message', async ({ page }) => {
    // === SETUP ===
    await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);
    await page.goto('/seller/products/create');

    // === ACTION ===
    await page.locator('[data-testid="product-submit-btn"]').click();

    // === VÉRIFICATION UI ===
    const photoError = page.locator('[data-testid="photo-error"]');
    await expect(photoError).toBeVisible();
    const errorText = await photoError.textContent();
    expect(errorText).toMatch(/photo.*requis/i);
  });

  test('name error shows "nom requis" message', async ({ page }) => {
    // === SETUP ===
    await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);
    await page.goto('/seller/products/create');

    // === ACTION ===
    await page.locator('[data-testid="product-submit-btn"]').click();

    // === VÉRIFICATION UI ===
    const nameError = page.locator('[data-testid="product-name-error"]');
    await expect(nameError).toBeVisible();
    const errorText = await nameError.textContent();
    expect(errorText).toMatch(/nom.*requis/i);
  });

  test('description error shows "description requise" message', async ({ page }) => {
    // === SETUP ===
    await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);
    await page.goto('/seller/products/create');

    // === ACTION ===
    await page.locator('[data-testid="product-submit-btn"]').click();

    // === VÉRIFICATION UI ===
    const descError = page.locator('[data-testid="product-description-error"]');
    await expect(descError).toBeVisible();
    const errorText = await descError.textContent();
    expect(errorText).toMatch(/description.*requis/i);
  });

  test('category error shows "sélectionner une catégorie" message', async ({ page }) => {
    // === SETUP ===
    await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);
    await page.goto('/seller/products/create');

    // === ACTION ===
    await page.locator('[data-testid="product-submit-btn"]').click();

    // === VÉRIFICATION UI ===
    const catError = page.locator('[data-testid="product-category-error"]');
    await expect(catError).toBeVisible();
    const errorText = await catError.textContent();
    expect(errorText).toMatch(/catégorie/i);
  });

  test('price error shows "prix requis" message when empty', async ({ page }) => {
    // === SETUP ===
    await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);
    await page.goto('/seller/products/create');

    // === ACTION ===
    await page.locator('[data-testid="product-submit-btn"]').click();

    // === VÉRIFICATION UI ===
    const priceError = page.locator('[data-testid="product-price-error"]');
    await expect(priceError).toBeVisible();
    const errorText = await priceError.textContent();
    expect(errorText).toMatch(/prix.*requis/i);
  });

  test('stock error shows "quantité requise" message when empty', async ({ page }) => {
    // === SETUP ===
    await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);
    await page.goto('/seller/products/create');

    // === ACTION ===
    await page.locator('[data-testid="product-submit-btn"]').click();

    // === VÉRIFICATION UI ===
    const stockError = page.locator('[data-testid="product-stock-error"]');
    await expect(stockError).toBeVisible();
    const errorText = await stockError.textContent();
    expect(errorText).toMatch(/quantité.*requis/i);
  });

  test('price with value 0 shows "supérieur à 0" error', async ({ page }) => {
    // === SETUP ===
    await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);
    await page.goto('/seller/products/create');

    // Fill only price with 0
    await page.locator('[data-testid="product-price-input"]').fill('0');

    // === ACTION ===
    await page.locator('[data-testid="product-submit-btn"]').click();

    // === VÉRIFICATION UI ===
    const priceError = page.locator('[data-testid="product-price-error"]');
    await expect(priceError).toBeVisible();
    const errorText = await priceError.textContent();
    expect(errorText).toMatch(/supérieur.*0/i);
  });

  test('negative price shows validation error', async ({ page }) => {
    // === SETUP ===
    await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);
    await page.goto('/seller/products/create');

    await page.locator('[data-testid="product-price-input"]').fill('-10');

    // === ACTION ===
    await page.locator('[data-testid="product-submit-btn"]').click();

    // === VÉRIFICATION UI ===
    const priceError = page.locator('[data-testid="product-price-error"]');
    await expect(priceError).toBeVisible();
    const errorText = await priceError.textContent();
    expect(errorText).toMatch(/supérieur.*0/i);
  });

  test('form is NOT submitted when validation fails (no product in DB)', async ({ page }) => {
    // === SETUP ===
    await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);
    await page.goto('/seller/products/create');

    // Only fill name to make validation partially fail
    const productName = uniqueProductName('Should-Not-Exist');
    await page.locator('[data-testid="product-name-input"]').fill(productName);

    // === ACTION ===
    await page.locator('[data-testid="product-submit-btn"]').click();

    // === VÉRIFICATION UI ===
    await expect(page.locator('[data-testid="product-form-general-error"]')).toBeVisible();

    // === VÉRIFICATION DB ===
    await db.assertNotExists('products', { name: productName });
  });
});

// ===========================================================================
// AC3 — SERVER-SIDE VALIDATION via API
// ===========================================================================

test.describe('Story 2.2 — AC3: Server-side validation errors (API)', () => {
  test('API returns 422 with validation errors for missing required fields', async ({ page }) => {
    // === SETUP ===
    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);

    // === ACTION: submit with no data ===
    const response = await page.request.post(`${API_URL}/seller/products`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      data: {},
    });

    // === VÉRIFICATION ===
    expect(response.status()).toBe(422);
    const json = await response.json();

    // Should have errors for required fields
    expect(json.errors).toBeDefined();
    expect(json.errors.name).toBeDefined();
    expect(json.errors.description).toBeDefined();
    expect(json.errors.category).toBeDefined();
    expect(json.errors.price).toBeDefined();
    expect(json.errors.stock_quantity).toBeDefined();
    expect(json.errors.photo).toBeDefined();
  });

  test('API returns 422 when price is 0 or negative', async ({ page }) => {
    // === SETUP ===
    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);

    // === ACTION ===
    const response = await page.request.post(`${API_URL}/seller/products`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      multipart: {
        name: 'Price validation test',
        description: 'Testing negative price',
        category: 'cpu',
        price: '-5',
        stock_quantity: '10',
        photo: {
          name: 'test.png',
          mimeType: 'image/png',
          buffer: createTestImageBuffer(),
        },
      },
    });

    // === VÉRIFICATION ===
    expect(response.status()).toBe(422);
    const json = await response.json();
    expect(json.errors.price).toBeDefined();
  });

  test('API returns 422 when stock is negative', async ({ page }) => {
    // === SETUP ===
    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);

    // === ACTION ===
    const response = await page.request.post(`${API_URL}/seller/products`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      multipart: {
        name: 'Stock validation test',
        description: 'Testing negative stock',
        category: 'cpu',
        price: '100',
        stock_quantity: '-1',
        photo: {
          name: 'test.png',
          mimeType: 'image/png',
          buffer: createTestImageBuffer(),
        },
      },
    });

    // === VÉRIFICATION ===
    expect(response.status()).toBe(422);
    const json = await response.json();
    expect(json.errors.stock_quantity).toBeDefined();
  });

  test('API returns 422 when category is invalid', async ({ page }) => {
    // === SETUP ===
    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);

    // === ACTION ===
    const response = await page.request.post(`${API_URL}/seller/products`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      multipart: {
        name: 'Invalid category test',
        description: 'Testing invalid category',
        category: 'invalid_category',
        price: '100',
        stock_quantity: '10',
        photo: {
          name: 'test.png',
          mimeType: 'image/png',
          buffer: createTestImageBuffer(),
        },
      },
    });

    // === VÉRIFICATION ===
    expect(response.status()).toBe(422);
    const json = await response.json();
    expect(json.errors.category).toBeDefined();
  });

  test('API returns 422 when photo exceeds 2MB', async ({ page }) => {
    // === SETUP ===
    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);

    // Create a buffer > 2MB (2.1 MB)
    const largeBuffer = Buffer.alloc(2.1 * 1024 * 1024, 'x');

    // === ACTION ===
    const response = await page.request.post(`${API_URL}/seller/products`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      multipart: {
        name: 'Large photo test',
        description: 'Testing photo too large',
        category: 'cpu',
        price: '100',
        stock_quantity: '10',
        photo: {
          name: 'huge.png',
          mimeType: 'image/png',
          buffer: largeBuffer,
        },
      },
    });

    // === VÉRIFICATION ===
    expect(response.status()).toBe(422);
    const json = await response.json();
    expect(json.errors.photo).toBeDefined();
  });

  test('server validation errors are displayed in the form UI', async ({ page }) => {
    // === SETUP ===
    await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);
    await page.goto('/seller/products/create');

    // Fill with an invalid category value via direct form manipulation won't work,
    // so we test by intercepting a server 422 response.
    // The frontend should display server errors next to the corresponding fields.

    // Fill all fields but the backend will reject (e.g., because category is invalid)
    // We need the form to pass client validation but fail server validation.

    // Fill all required fields with valid client data
    const productName = uniqueProductName('Server-Error');
    await fillValidProductForm(page, { name: productName });

    // Intercept the API call and return a 422 with field errors
    await page.route(`${API_URL}/seller/products`, (route) => {
      route.fulfill({
        status: 422,
        contentType: 'application/json',
        body: JSON.stringify({
          message: 'The given data was invalid.',
          errors: {
            name: ['Le nom est déjà utilisé.'],
            price: ['Le prix doit être supérieur à 0.'],
          },
        }),
      });
    });

    // === ACTION ===
    await page.locator('[data-testid="product-submit-btn"]').click();

    // === VÉRIFICATION UI ===
    // Server errors should be displayed for name and price fields
    await expect(page.locator('[data-testid="product-name-error"]')).toBeVisible({ timeout: 10_000 });
    const nameError = await page.locator('[data-testid="product-name-error"]').textContent();
    expect(nameError).toContain('déjà utilisé');

    await expect(page.locator('[data-testid="product-price-error"]')).toBeVisible();
    const priceError = await page.locator('[data-testid="product-price-error"]').textContent();
    expect(priceError).toContain('supérieur à 0');
  });
});

// ===========================================================================
// NAVIGATION — Cancel button and form escape
// ===========================================================================

test.describe('Story 2.2 — Navigation: Cancel and back navigation', () => {
  test('cancel button navigates back to seller dashboard', async ({ page }) => {
    // === SETUP ===
    await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);
    await page.goto('/seller/products/create');

    // === ACTION ===
    await page.locator('[data-testid="product-cancel-btn"]').click();

    // === VÉRIFICATION UI ===
    await page.waitForURL('**/seller/dashboard', { timeout: 10_000 });
    await expect(page.locator('[data-testid="seller-dashboard-title"]')).toBeVisible();
  });

  test('cancel does NOT create a product in DB', async ({ page }) => {
    // === SETUP ===
    await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);
    await page.goto('/seller/products/create');

    const productName = uniqueProductName('Cancel-No-Create');
    await page.locator('[data-testid="product-name-input"]').fill(productName);

    // === ACTION ===
    await page.locator('[data-testid="product-cancel-btn"]').click();

    // === VÉRIFICATION DB ===
    await db.assertNotExists('products', { name: productName });
  });
});

// ===========================================================================
// ROLE PROTECTION — Only vendeur can access product creation
// ===========================================================================

test.describe('Story 2.2 — Role protection: only vendeur can create products', () => {
  test('acheteur accessing /seller/products/create is redirected to /unauthorized', async ({
    page,
  }) => {
    // === SETUP ===
    await loginAs(page, ACHETEUR_EMAIL, ACHETEUR_PASSWORD);

    // === ACTION ===
    await page.goto('/seller/products/create');

    // === VÉRIFICATION UI ===
    await page.waitForURL((url) => url.pathname.includes('/unauthorized'), {
      timeout: 10_000,
    });
    await expect(page.locator('[data-testid="product-form-title"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="product-form"]')).not.toBeVisible();
  });

  test('visitor (not logged in) accessing /seller/products/create is redirected to /login', async ({
    page,
  }) => {
    // === ACTION ===
    await page.goto('/seller/products/create');

    // === VÉRIFICATION UI ===
    await page.waitForURL((url) => url.pathname.includes('/login'), {
      timeout: 10_000,
    });
    await expect(page.locator('[data-testid="product-form-title"]')).not.toBeVisible();
  });

  test('admin accessing /seller/products/create is redirected appropriately', async ({ page }) => {
    // === SETUP ===
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);

    // === ACTION ===
    await page.goto('/seller/products/create');

    // === VÉRIFICATION UI ===
    // Admin is not a vendeur, should be redirected to /unauthorized
    await page.waitForURL((url) => url.pathname.includes('/unauthorized'), {
      timeout: 10_000,
    });
    await expect(page.locator('[data-testid="product-form-title"]')).not.toBeVisible();
  });
});

// ===========================================================================
// DB VERIFICATION — Data integrity checks
// ===========================================================================

test.describe('Story 2.2 — DB verification: product data integrity', () => {
  test('product category is stored as valid enum value in DB', async ({ page }) => {
    // === SETUP ===
    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);
    const productName = uniqueProductName('Category-Enum');

    // === ACTION ===
    const response = await page.request.post(`${API_URL}/seller/products`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      multipart: {
        name: productName,
        description: 'Testing category enum storage',
        category: 'alimentation',
        price: '79.99',
        stock_quantity: '15',
        specs: JSON.stringify([]),
        photo: {
          name: 'test.png',
          mimeType: 'image/png',
          buffer: createTestImageBuffer(),
        },
      },
    });

    expect(response.status()).toBe(201);

    // === VÉRIFICATION DB ===
    const product = await db.findOne('products', { name: productName });
    expect(product).toBeTruthy();
    expect(product!.category).toBe('alimentation');
    expect(PRODUCT_CATEGORIES).toContain(product!.category);
  });

  test('stock_quantity with value 0 is correctly stored', async ({ page }) => {
    // === SETUP ===
    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);
    const productName = uniqueProductName('Zero-Stock');

    // === ACTION ===
    const response = await page.request.post(`${API_URL}/seller/products`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      multipart: {
        name: productName,
        description: 'Product with zero stock',
        category: 'gpu',
        price: '999.99',
        stock_quantity: '0',
        specs: JSON.stringify([]),
        photo: {
          name: 'test.png',
          mimeType: 'image/png',
          buffer: createTestImageBuffer(),
        },
      },
    });

    expect(response.status()).toBe(201);

    // === VÉRIFICATION DB ===
    const product = await db.findOne('products', { name: productName });
    expect(product).toBeTruthy();
    expect(product!.stock_quantity).toBe(0);
  });

  test('specs JSON is correctly stored in DB', async ({ page }) => {
    // === SETUP ===
    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);
    const productName = uniqueProductName('Specs-JSON');

    const specs = [
      { key: 'Processeur', value: 'AMD Ryzen 9 7950X' },
      { key: 'Fréquence', value: '4.5 GHz base / 5.7 GHz boost' },
      { key: 'Cores', value: '16 cœurs / 32 threads' },
    ];

    // === ACTION ===
    const response = await page.request.post(`${API_URL}/seller/products`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      multipart: {
        name: productName,
        description: 'Testing specs JSON storage',
        category: 'cpu',
        price: '599.99',
        stock_quantity: '5',
        specs: JSON.stringify(specs),
        photo: {
          name: 'test.png',
          mimeType: 'image/png',
          buffer: createTestImageBuffer(),
        },
      },
    });

    expect(response.status()).toBe(201);

    // === VÉRIFICATION DB ===
    const product = await db.findOne('products', { name: productName });
    expect(product).toBeTruthy();

    const storedSpecs =
      typeof product!.specs === 'string' ? JSON.parse(product!.specs) : product!.specs;
    expect(storedSpecs).toHaveLength(3);
    expect(storedSpecs[0].key).toBe('Processeur');
    expect(storedSpecs[0].value).toBe('AMD Ryzen 9 7950X');
    expect(storedSpecs[2].key).toBe('Cores');
  });

  test('product with all 8 categories can be created', async ({ page }) => {
    // === SETUP ===
    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);

    // === ACTION & VÉRIFICATION ===
    // Verify each category is accepted by the backend
    for (const category of PRODUCT_CATEGORIES) {
      const productName = uniqueProductName(`Cat-${category}`);

      const response = await page.request.post(`${API_URL}/seller/products`, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        multipart: {
          name: productName,
          description: `Test product for category ${category}`,
          category: category,
          price: '49.99',
          stock_quantity: '10',
          specs: JSON.stringify([]),
          photo: {
            name: 'test.png',
            mimeType: 'image/png',
            buffer: createTestImageBuffer(),
          },
        },
      });

      expect(response.status()).toBe(201);

      // === VÉRIFICATION DB ===
      const product = await db.findOne('products', { name: productName });
      expect(product).toBeTruthy();
      expect(product!.category).toBe(category);
    }
  });
});

// ===========================================================================
// SELLER ISOLATION — product belongs only to creator
// ===========================================================================

test.describe('Story 2.2 — Seller isolation: product ownership', () => {
  test('product created by vendeur1 is NOT visible to vendeur2 API', async ({ page }) => {
    // === SETUP ===
    const { token: token1, userId: userId1 } = await loginAs(
      page,
      VENDEUR_EMAIL,
      VENDEUR_PASSWORD
    );
    const productName = uniqueProductName('Isolation-V1');

    // Create product as vendeur1
    const createResponse = await page.request.post(`${API_URL}/seller/products`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token1}`,
      },
      multipart: {
        name: productName,
        description: 'Vendeur1 product for isolation test',
        category: 'cpu',
        price: '299.99',
        stock_quantity: '5',
        specs: JSON.stringify([]),
        photo: {
          name: 'test.png',
          mimeType: 'image/png',
          buffer: createTestImageBuffer(),
        },
      },
    });
    expect(createResponse.status()).toBe(201);

    // === VÉRIFICATION DB: product belongs to vendeur1 ===
    const product = await db.findOne('products', { name: productName });
    expect(product).toBeTruthy();
    expect(product!.user_id).toBe(userId1);

    // === ACTION: vendeur2 fetches products ===
    // Register/login as a different vendeur
    const vendeur2Email = `e2e-vendeur2-iso-${Date.now()}@test.com`;
    const registerResponse = await page.request.post(`${API_URL}/auth/register`, {
      data: {
        email: vendeur2Email,
        password: 'password',
        password_confirmation: 'password',
        role: 'vendeur',
        name: 'E2E Vendeur2 Isolation',
      },
    });

    if (registerResponse.ok()) {
      const { token: token2 } = await loginAs(page, vendeur2Email, 'password');

      const listResponse = await page.request.get(`${API_URL}/seller/products`, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token2}`,
        },
      });

      expect(listResponse.status()).toBe(200);
      const json = await listResponse.json();
      const productNames = json.data.map((p: any) => p.name);
      expect(productNames).not.toContain(productName);

      // Cleanup vendeur2
      await db.query('DELETE FROM products WHERE user_id IN (SELECT id FROM users WHERE email = ?)', [vendeur2Email]);
      await db.query('DELETE FROM users WHERE email = ?', [vendeur2Email]);
    }
  });
});
