import { test, expect, Page } from '@playwright/test';
import { loginAs, logout } from '../helpers/auth';
import { db } from '../helpers/database';

/**
 * Story 2.3 — Edit Product Listing
 *
 * AC1: Given a seller clicks "Edit" on one of their products
 *      When the edit form loads
 *      Then all current values are pre-filled in the form
 *
 * AC2: Given a seller modifies fields and saves
 *      When the form is submitted with valid data
 *      Then the product is updated and a success confirmation is shown
 *
 * AC3: Given a seller tries to edit a product that belongs to another seller
 *      When the request is made
 *      Then the system returns an unauthorized error
 *
 * Pre-conditions:
 * - e2e-vendeur@test.com / password exists with role "vendeur" (from E2ETestSeeder)
 * - e2e@test.com / password exists with role "acheteur" (from E2ETestSeeder)
 * - e2e-admin@test.com / password exists with role "admin" (from E2ETestSeeder)
 *
 * The tests describe EXPECTED behavior (TDD). They will fail until:
 * - Backend: SellerProductController@show (GET /api/seller/products/{id}) implemented
 * - Backend: SellerProductController@update (PUT /api/seller/products/{id}) implemented
 * - Backend: UpdateProductRequest Form Request with validation rules
 * - Backend: Ownership scoping (403 when editing another seller's product)
 * - Backend: Optional photo replacement on update
 * - Frontend: ProductFormPage.vue wired to real API (GET for fetch, PUT for update)
 * - Frontend: Pre-fill form fields from API response
 * - Frontend: Success toast + redirect to dashboard on update
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
// Helpers
// ---------------------------------------------------------------------------

/** Generate a unique product name for test isolation */
function uniqueProductName(label: string): string {
  return `E2E-2.3-${label}-${Date.now()}`;
}

/** Minimal 1x1 PNG buffer for photo upload tests */
function createTestImageBuffer(): Buffer {
  return Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
    'base64'
  );
}

/**
 * Create a product via API for a given seller, returning the product id.
 * This is used as test setup to ensure a product exists before testing edit.
 */
async function createProductViaAPI(
  page: Page,
  token: string,
  overrides?: {
    name?: string;
    description?: string;
    category?: string;
    price?: string;
    stock_quantity?: string;
    specs?: Array<{ key: string; value: string }>;
  }
): Promise<{ id: number; name: string }> {
  const productName = overrides?.name ?? uniqueProductName('Setup');

  const response = await page.request.post(`${API_URL}/seller/products`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
    multipart: {
      name: productName,
      description: overrides?.description ?? 'Produit de test pour edit E2E.',
      category: overrides?.category ?? 'cpu',
      price: overrides?.price ?? '299.99',
      stock_quantity: overrides?.stock_quantity ?? '15',
      specs: JSON.stringify(
        overrides?.specs ?? [
          { key: 'Coeurs', value: '8' },
          { key: 'Socket', value: 'AM5' },
        ]
      ),
      photo: {
        name: 'test-product.png',
        mimeType: 'image/png',
        buffer: createTestImageBuffer(),
      },
    },
  });

  if (!response.ok()) {
    const body = await response.text();
    throw new Error(`Failed to create setup product (${response.status()}): ${body}`);
  }

  const json = await response.json();
  return { id: json.data.id, name: productName };
}

// ---------------------------------------------------------------------------
// Setup & Cleanup
// ---------------------------------------------------------------------------

test.afterAll(async () => {
  await db.query('DELETE FROM products WHERE name LIKE ?', ['E2E-2.3-%']);
  await db.cleanup();
});

// ===========================================================================
// AC1 — FORM PRE-FILL: edit form loads with current product values
// ===========================================================================

test.describe('Story 2.3 — AC1: Edit form loads with pre-filled values', () => {
  test('edit form is accessible at /seller/products/{id}/edit for vendeur', async ({ page }) => {
    // === SETUP ===
    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);
    const { id: productId } = await createProductViaAPI(page, token);

    // === ACTION ===
    await page.goto(`/seller/products/${productId}/edit`);

    // === VÉRIFICATION UI ===
    await page.waitForURL(`**/seller/products/${productId}/edit`);
    await expect(page.locator('[data-testid="product-form-title"]')).toBeVisible();
    await expect(page.locator('[data-testid="product-form-title"]')).toHaveText('Modifier le produit');
  });

  test('edit form subtitle describes edit mode purpose', async ({ page }) => {
    // === SETUP ===
    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);
    const { id: productId } = await createProductViaAPI(page, token);

    // === ACTION ===
    await page.goto(`/seller/products/${productId}/edit`);

    // === VÉRIFICATION UI ===
    await expect(page.locator('[data-testid="product-form-subtitle"]')).toBeVisible();
    const subtitle = await page.locator('[data-testid="product-form-subtitle"]').textContent();
    expect(subtitle).toMatch(/modifi|optionnelle|conserve/i);
  });

  test('product name is pre-filled in the form', async ({ page }) => {
    // === SETUP ===
    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);
    const productName = uniqueProductName('Prefill-Name');
    const { id: productId } = await createProductViaAPI(page, token, { name: productName });

    // === ACTION ===
    await page.goto(`/seller/products/${productId}/edit`);

    // === VÉRIFICATION UI ===
    await expect(page.locator('[data-testid="product-form"]')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('[data-testid="product-name-input"]')).toHaveValue(productName);
  });

  test('product description is pre-filled in the form', async ({ page }) => {
    // === SETUP ===
    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);
    const description = 'Description unique pour test de pre-remplissage edit E2E.';
    const { id: productId } = await createProductViaAPI(page, token, { description });

    // === ACTION ===
    await page.goto(`/seller/products/${productId}/edit`);

    // === VÉRIFICATION UI ===
    await expect(page.locator('[data-testid="product-form"]')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('[data-testid="product-description-input"]')).toHaveValue(description);
  });

  test('product category is pre-selected in the form', async ({ page }) => {
    // === SETUP ===
    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);
    const { id: productId } = await createProductViaAPI(page, token, { category: 'gpu' });

    // === ACTION ===
    await page.goto(`/seller/products/${productId}/edit`);

    // === VÉRIFICATION UI ===
    await expect(page.locator('[data-testid="product-form"]')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('[data-testid="product-category-select"]')).toHaveValue('gpu');
  });

  test('product price is pre-filled in the form', async ({ page }) => {
    // === SETUP ===
    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);
    const { id: productId } = await createProductViaAPI(page, token, { price: '1499.99' });

    // === ACTION ===
    await page.goto(`/seller/products/${productId}/edit`);

    // === VÉRIFICATION UI ===
    await expect(page.locator('[data-testid="product-form"]')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('[data-testid="product-price-input"]')).toHaveValue('1499.99');
  });

  test('product stock quantity is pre-filled in the form', async ({ page }) => {
    // === SETUP ===
    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);
    const { id: productId } = await createProductViaAPI(page, token, { stock_quantity: '42' });

    // === ACTION ===
    await page.goto(`/seller/products/${productId}/edit`);

    // === VÉRIFICATION UI ===
    await expect(page.locator('[data-testid="product-form"]')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('[data-testid="product-stock-input"]')).toHaveValue('42');
  });

  test('product specs are pre-filled in the form', async ({ page }) => {
    // === SETUP ===
    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);
    const specs = [
      { key: 'VRAM', value: '24 Go' },
      { key: 'TDP', value: '450W' },
    ];
    const { id: productId } = await createProductViaAPI(page, token, { specs });

    // === ACTION ===
    await page.goto(`/seller/products/${productId}/edit`);

    // === VÉRIFICATION UI ===
    await expect(page.locator('[data-testid="product-form"]')).toBeVisible({ timeout: 10_000 });

    // Both spec rows should be visible with pre-filled values
    await expect(page.locator('[data-testid="spec-row-0"]')).toBeVisible();
    await expect(page.locator('[data-testid="spec-key-input-0"]')).toHaveValue('VRAM');
    await expect(page.locator('[data-testid="spec-value-input-0"]')).toHaveValue('24 Go');

    await expect(page.locator('[data-testid="spec-row-1"]')).toBeVisible();
    await expect(page.locator('[data-testid="spec-key-input-1"]')).toHaveValue('TDP');
    await expect(page.locator('[data-testid="spec-value-input-1"]')).toHaveValue('450W');
  });

  test('existing product photo is displayed in edit mode', async ({ page }) => {
    // === SETUP ===
    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);
    const { id: productId } = await createProductViaAPI(page, token);

    // === ACTION ===
    await page.goto(`/seller/products/${productId}/edit`);

    // === VÉRIFICATION UI ===
    await expect(page.locator('[data-testid="product-form"]')).toBeVisible({ timeout: 10_000 });
    // Existing photo should be displayed (not the upload zone)
    await expect(page.locator('[data-testid="photo-existing"]')).toBeVisible();
    await expect(page.locator('[data-testid="photo-existing-img"]')).toBeVisible();
    // Upload zone should NOT be visible when existing photo is shown
    await expect(page.locator('[data-testid="photo-upload-zone"]')).not.toBeVisible();
  });

  test('photo replace and remove buttons are visible with existing photo', async ({ page }) => {
    // === SETUP ===
    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);
    const { id: productId } = await createProductViaAPI(page, token);

    // === ACTION ===
    await page.goto(`/seller/products/${productId}/edit`);

    // === VÉRIFICATION UI ===
    await expect(page.locator('[data-testid="product-form"]')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('[data-testid="photo-replace-btn"]')).toBeVisible();
    await expect(page.locator('[data-testid="photo-remove-existing-btn"]')).toBeVisible();
  });

  test('submit button shows "Enregistrer les modifications" in edit mode', async ({ page }) => {
    // === SETUP ===
    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);
    const { id: productId } = await createProductViaAPI(page, token);

    // === ACTION ===
    await page.goto(`/seller/products/${productId}/edit`);

    // === VÉRIFICATION UI ===
    await expect(page.locator('[data-testid="product-form"]')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('[data-testid="product-submit-btn"]')).toContainText(
      /enregistrer les modifications/i
    );
  });

  test('photo is not required in edit mode (no error if no new photo)', async ({ page }) => {
    // === SETUP ===
    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);
    const { id: productId } = await createProductViaAPI(page, token);

    // === ACTION ===
    await page.goto(`/seller/products/${productId}/edit`);
    await expect(page.locator('[data-testid="product-form"]')).toBeVisible({ timeout: 10_000 });

    // Submit without changing photo — should NOT show photo error
    await page.locator('[data-testid="product-submit-btn"]').click();

    // === VÉRIFICATION UI ===
    await expect(page.locator('[data-testid="photo-error"]')).not.toBeVisible();
  });

  test('loading spinner is shown while fetching product data', async ({ page }) => {
    // === SETUP ===
    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);
    const { id: productId } = await createProductViaAPI(page, token);

    // Intercept the API call to delay the response
    await page.route(`${API_URL}/seller/products/${productId}`, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      route.continue();
    });

    // === ACTION ===
    await page.goto(`/seller/products/${productId}/edit`);

    // === VÉRIFICATION UI ===
    await expect(page.locator('[data-testid="product-form-loading"]')).toBeVisible();
  });
});

// ===========================================================================
// AC1 — NAVIGATION: seller navigates to edit from dashboard
// ===========================================================================

test.describe('Story 2.3 — AC1: Navigation from dashboard to edit form', () => {
  test('"Edit" button on dashboard navigates to edit form', async ({ page }) => {
    // === SETUP ===
    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);
    const { id: productId } = await createProductViaAPI(page, token);

    // === ACTION ===
    await page.goto('/seller/dashboard');
    await expect(page.locator(`[data-testid="seller-product-row-${productId}"]`)).toBeVisible({
      timeout: 10_000,
    });
    await page.locator(`[data-testid="seller-edit-product-btn-${productId}"]`).click();

    // === VÉRIFICATION UI ===
    await page.waitForURL(`**/seller/products/${productId}/edit`, { timeout: 10_000 });
    await expect(page.locator('[data-testid="product-form-title"]')).toBeVisible();
    await expect(page.locator('[data-testid="product-form-title"]')).toHaveText('Modifier le produit');
  });
});

// ===========================================================================
// AC1 — PHOTO INTERACTIONS: replace and remove existing photo
// ===========================================================================

test.describe('Story 2.3 — AC1: Photo interactions in edit mode', () => {
  test('clicking "Remplacer" allows selecting a new photo', async ({ page }) => {
    // === SETUP ===
    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);
    const { id: productId } = await createProductViaAPI(page, token);

    await page.goto(`/seller/products/${productId}/edit`);
    await expect(page.locator('[data-testid="product-form"]')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('[data-testid="photo-existing"]')).toBeVisible();

    // === ACTION ===
    // Use the replace button's file input
    const fileInput = page.locator('#photo-input-replace');
    await fileInput.setInputFiles({
      name: 'new-photo.png',
      mimeType: 'image/png',
      buffer: createTestImageBuffer(),
    });

    // === VÉRIFICATION UI ===
    // Existing photo should be replaced by new photo preview
    await expect(page.locator('[data-testid="photo-preview"]')).toBeVisible();
    await expect(page.locator('[data-testid="photo-preview-img"]')).toBeVisible();
    await expect(page.locator('[data-testid="photo-existing"]')).not.toBeVisible();
  });

  test('clicking "Supprimer" removes existing photo and shows upload zone', async ({ page }) => {
    // === SETUP ===
    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);
    const { id: productId } = await createProductViaAPI(page, token);

    await page.goto(`/seller/products/${productId}/edit`);
    await expect(page.locator('[data-testid="product-form"]')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('[data-testid="photo-existing"]')).toBeVisible();

    // === ACTION ===
    await page.locator('[data-testid="photo-remove-existing-btn"]').click();

    // === VÉRIFICATION UI ===
    await expect(page.locator('[data-testid="photo-existing"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="photo-upload-zone"]')).toBeVisible();
  });
});

// ===========================================================================
// AC2 — HAPPY PATH: successful product update
// ===========================================================================

test.describe('Story 2.3 — AC2: Successful product update', () => {
  test('modifying name and saving shows success message', async ({ page }) => {
    // === SETUP ===
    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);
    const originalName = uniqueProductName('Update-Name-Orig');
    const { id: productId } = await createProductViaAPI(page, token, { name: originalName });

    const newName = uniqueProductName('Update-Name-New');

    // === ACTION ===
    await page.goto(`/seller/products/${productId}/edit`);
    await expect(page.locator('[data-testid="product-form"]')).toBeVisible({ timeout: 10_000 });

    await page.locator('[data-testid="product-name-input"]').clear();
    await page.locator('[data-testid="product-name-input"]').fill(newName);
    await page.locator('[data-testid="product-submit-btn"]').click();

    // === VÉRIFICATION UI ===
    await expect(page.locator('[data-testid="product-form-success-message"]')).toBeVisible({
      timeout: 10_000,
    });
    const successText = await page
      .locator('[data-testid="product-form-success-message"]')
      .textContent();
    expect(successText).toMatch(/succès|mis à jour/i);

    // === VÉRIFICATION DB ===
    const product = await db.findOne('products', { id: productId });
    expect(product).toBeTruthy();
    expect(product!.name).toBe(newName);
  });

  test('modifying description updates the product in DB', async ({ page }) => {
    // === SETUP ===
    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);
    const { id: productId } = await createProductViaAPI(page, token);

    const newDescription = 'Nouvelle description mise à jour via E2E test.';

    // === ACTION ===
    await page.goto(`/seller/products/${productId}/edit`);
    await expect(page.locator('[data-testid="product-form"]')).toBeVisible({ timeout: 10_000 });

    await page.locator('[data-testid="product-description-input"]').clear();
    await page.locator('[data-testid="product-description-input"]').fill(newDescription);
    await page.locator('[data-testid="product-submit-btn"]').click();

    // === VÉRIFICATION UI ===
    await expect(page.locator('[data-testid="product-form-success-message"]')).toBeVisible({
      timeout: 10_000,
    });

    // === VÉRIFICATION DB ===
    const product = await db.findOne('products', { id: productId });
    expect(product).toBeTruthy();
    expect(product!.description).toBe(newDescription);
  });

  test('modifying price updates the product in DB', async ({ page }) => {
    // === SETUP ===
    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);
    const { id: productId } = await createProductViaAPI(page, token, { price: '199.99' });

    // === ACTION ===
    await page.goto(`/seller/products/${productId}/edit`);
    await expect(page.locator('[data-testid="product-form"]')).toBeVisible({ timeout: 10_000 });

    await page.locator('[data-testid="product-price-input"]').clear();
    await page.locator('[data-testid="product-price-input"]').fill('349.99');
    await page.locator('[data-testid="product-submit-btn"]').click();

    // === VÉRIFICATION UI ===
    await expect(page.locator('[data-testid="product-form-success-message"]')).toBeVisible({
      timeout: 10_000,
    });

    // === VÉRIFICATION DB ===
    const product = await db.findOne('products', { id: productId });
    expect(product).toBeTruthy();
    expect(Number(product!.price)).toBeCloseTo(349.99, 2);
  });

  test('modifying stock quantity updates the product in DB', async ({ page }) => {
    // === SETUP ===
    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);
    const { id: productId } = await createProductViaAPI(page, token, { stock_quantity: '10' });

    // === ACTION ===
    await page.goto(`/seller/products/${productId}/edit`);
    await expect(page.locator('[data-testid="product-form"]')).toBeVisible({ timeout: 10_000 });

    await page.locator('[data-testid="product-stock-input"]').clear();
    await page.locator('[data-testid="product-stock-input"]').fill('99');
    await page.locator('[data-testid="product-submit-btn"]').click();

    // === VÉRIFICATION UI ===
    await expect(page.locator('[data-testid="product-form-success-message"]')).toBeVisible({
      timeout: 10_000,
    });

    // === VÉRIFICATION DB ===
    const product = await db.findOne('products', { id: productId });
    expect(product).toBeTruthy();
    expect(product!.stock_quantity).toBe(99);
  });

  test('modifying category updates the product in DB', async ({ page }) => {
    // === SETUP ===
    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);
    const { id: productId } = await createProductViaAPI(page, token, { category: 'cpu' });

    // === ACTION ===
    await page.goto(`/seller/products/${productId}/edit`);
    await expect(page.locator('[data-testid="product-form"]')).toBeVisible({ timeout: 10_000 });

    await page.locator('[data-testid="product-category-select"]').selectOption('gpu');
    await page.locator('[data-testid="product-submit-btn"]').click();

    // === VÉRIFICATION UI ===
    await expect(page.locator('[data-testid="product-form-success-message"]')).toBeVisible({
      timeout: 10_000,
    });

    // === VÉRIFICATION DB ===
    const product = await db.findOne('products', { id: productId });
    expect(product).toBeTruthy();
    expect(product!.category).toBe('gpu');
  });

  test('modifying specs updates the product in DB', async ({ page }) => {
    // === SETUP ===
    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);
    const { id: productId } = await createProductViaAPI(page, token, {
      specs: [{ key: 'Socket', value: 'AM5' }],
    });

    // === ACTION ===
    await page.goto(`/seller/products/${productId}/edit`);
    await expect(page.locator('[data-testid="product-form"]')).toBeVisible({ timeout: 10_000 });

    // Modify existing spec
    await page.locator('[data-testid="spec-key-input-0"]').clear();
    await page.locator('[data-testid="spec-key-input-0"]').fill('TDP');
    await page.locator('[data-testid="spec-value-input-0"]').clear();
    await page.locator('[data-testid="spec-value-input-0"]').fill('105W');

    // Add a new spec
    await page.locator('[data-testid="spec-add-btn"]').click();
    await page.locator('[data-testid="spec-key-input-1"]').fill('Architecture');
    await page.locator('[data-testid="spec-value-input-1"]').fill('Zen 4');

    await page.locator('[data-testid="product-submit-btn"]').click();

    // === VÉRIFICATION UI ===
    await expect(page.locator('[data-testid="product-form-success-message"]')).toBeVisible({
      timeout: 10_000,
    });

    // === VÉRIFICATION DB ===
    const product = await db.findOne('products', { id: productId });
    expect(product).toBeTruthy();
    const storedSpecs =
      typeof product!.specs === 'string' ? JSON.parse(product!.specs) : product!.specs;
    expect(storedSpecs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'TDP', value: '105W' }),
        expect.objectContaining({ key: 'Architecture', value: 'Zen 4' }),
      ])
    );
  });

  test('replacing photo updates the photo_path in DB', async ({ page }) => {
    // === SETUP ===
    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);
    const { id: productId } = await createProductViaAPI(page, token);

    // Get original photo path
    const originalProduct = await db.findOne('products', { id: productId });
    const originalPhotoPath = originalProduct!.photo_path;

    // === ACTION ===
    await page.goto(`/seller/products/${productId}/edit`);
    await expect(page.locator('[data-testid="product-form"]')).toBeVisible({ timeout: 10_000 });

    // Replace photo via the file input
    const fileInput = page.locator('[data-testid="photo-input"]');
    // If existing photo is shown, use the replace input instead
    const replaceInput = page.locator('#photo-input-replace');
    const photoInput = (await replaceInput.count()) > 0 ? replaceInput : fileInput;
    await photoInput.setInputFiles({
      name: 'updated-photo.png',
      mimeType: 'image/png',
      buffer: createTestImageBuffer(),
    });

    await page.locator('[data-testid="product-submit-btn"]').click();

    // === VÉRIFICATION UI ===
    await expect(page.locator('[data-testid="product-form-success-message"]')).toBeVisible({
      timeout: 10_000,
    });

    // === VÉRIFICATION DB ===
    const updatedProduct = await db.findOne('products', { id: productId });
    expect(updatedProduct).toBeTruthy();
    expect(updatedProduct!.photo_path).toBeTruthy();
    // Photo path should have changed (new upload = new file)
    expect(updatedProduct!.photo_path).not.toBe(originalPhotoPath);
  });

  test('updating without changing photo keeps the original photo', async ({ page }) => {
    // === SETUP ===
    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);
    const { id: productId } = await createProductViaAPI(page, token);

    const originalProduct = await db.findOne('products', { id: productId });
    const originalPhotoPath = originalProduct!.photo_path;

    // === ACTION ===
    await page.goto(`/seller/products/${productId}/edit`);
    await expect(page.locator('[data-testid="product-form"]')).toBeVisible({ timeout: 10_000 });

    // Only change the name, do NOT touch the photo
    const newName = uniqueProductName('Keep-Photo');
    await page.locator('[data-testid="product-name-input"]').clear();
    await page.locator('[data-testid="product-name-input"]').fill(newName);
    await page.locator('[data-testid="product-submit-btn"]').click();

    // === VÉRIFICATION UI ===
    await expect(page.locator('[data-testid="product-form-success-message"]')).toBeVisible({
      timeout: 10_000,
    });

    // === VÉRIFICATION DB ===
    const updatedProduct = await db.findOne('products', { id: productId });
    expect(updatedProduct).toBeTruthy();
    expect(updatedProduct!.name).toBe(newName);
    // Photo path should remain unchanged
    expect(updatedProduct!.photo_path).toBe(originalPhotoPath);
  });

  test('seller is redirected to dashboard after successful update', async ({ page }) => {
    // === SETUP ===
    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);
    const { id: productId } = await createProductViaAPI(page, token);

    // === ACTION ===
    await page.goto(`/seller/products/${productId}/edit`);
    await expect(page.locator('[data-testid="product-form"]')).toBeVisible({ timeout: 10_000 });

    const newName = uniqueProductName('Redirect-After-Update');
    await page.locator('[data-testid="product-name-input"]').clear();
    await page.locator('[data-testid="product-name-input"]').fill(newName);
    await page.locator('[data-testid="product-submit-btn"]').click();

    // === VÉRIFICATION UI ===
    await page.waitForURL('**/seller/dashboard', { timeout: 15_000 });
    await expect(page.locator('[data-testid="seller-dashboard-title"]')).toBeVisible();
  });

  test('submit button shows spinner during update submission', async ({ page }) => {
    // === SETUP ===
    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);
    const { id: productId } = await createProductViaAPI(page, token);

    // === ACTION ===
    await page.goto(`/seller/products/${productId}/edit`);
    await expect(page.locator('[data-testid="product-form"]')).toBeVisible({ timeout: 10_000 });
    await page.locator('[data-testid="product-submit-btn"]').click();

    // === VÉRIFICATION UI ===
    await expect(page.locator('[data-testid="product-submit-btn"]')).toBeDisabled();
  });

  test('product ownership (user_id) does not change after update', async ({ page }) => {
    // === SETUP ===
    const { token, userId } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);
    const { id: productId } = await createProductViaAPI(page, token);

    // === ACTION ===
    await page.goto(`/seller/products/${productId}/edit`);
    await expect(page.locator('[data-testid="product-form"]')).toBeVisible({ timeout: 10_000 });

    const newName = uniqueProductName('Keep-Owner');
    await page.locator('[data-testid="product-name-input"]').clear();
    await page.locator('[data-testid="product-name-input"]').fill(newName);
    await page.locator('[data-testid="product-submit-btn"]').click();

    await expect(page.locator('[data-testid="product-form-success-message"]')).toBeVisible({
      timeout: 10_000,
    });

    // === VÉRIFICATION DB ===
    const product = await db.findOne('products', { id: productId });
    expect(product).toBeTruthy();
    expect(product!.user_id).toBe(userId);
  });

  test('modifying multiple fields at once updates all values in DB', async ({ page }) => {
    // === SETUP ===
    const { token, userId } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);
    const { id: productId } = await createProductViaAPI(page, token, {
      name: uniqueProductName('Multi-Orig'),
      description: 'Original description',
      category: 'cpu',
      price: '100',
      stock_quantity: '5',
      specs: [{ key: 'OldKey', value: 'OldValue' }],
    });

    const newName = uniqueProductName('Multi-New');

    // === ACTION ===
    await page.goto(`/seller/products/${productId}/edit`);
    await expect(page.locator('[data-testid="product-form"]')).toBeVisible({ timeout: 10_000 });

    await page.locator('[data-testid="product-name-input"]').clear();
    await page.locator('[data-testid="product-name-input"]').fill(newName);

    await page.locator('[data-testid="product-description-input"]').clear();
    await page.locator('[data-testid="product-description-input"]').fill('Updated description');

    await page.locator('[data-testid="product-category-select"]').selectOption('ram');

    await page.locator('[data-testid="product-price-input"]').clear();
    await page.locator('[data-testid="product-price-input"]').fill('249.99');

    await page.locator('[data-testid="product-stock-input"]').clear();
    await page.locator('[data-testid="product-stock-input"]').fill('50');

    await page.locator('[data-testid="spec-key-input-0"]').clear();
    await page.locator('[data-testid="spec-key-input-0"]').fill('Capacité');
    await page.locator('[data-testid="spec-value-input-0"]').clear();
    await page.locator('[data-testid="spec-value-input-0"]').fill('32 Go');

    await page.locator('[data-testid="product-submit-btn"]').click();

    // === VÉRIFICATION UI ===
    await expect(page.locator('[data-testid="product-form-success-message"]')).toBeVisible({
      timeout: 10_000,
    });

    // === VÉRIFICATION DB ===
    const product = await db.findOne('products', { id: productId });
    expect(product).toBeTruthy();
    expect(product!.name).toBe(newName);
    expect(product!.description).toBe('Updated description');
    expect(product!.category).toBe('ram');
    expect(Number(product!.price)).toBeCloseTo(249.99, 2);
    expect(product!.stock_quantity).toBe(50);
    expect(product!.user_id).toBe(userId);

    const storedSpecs =
      typeof product!.specs === 'string' ? JSON.parse(product!.specs) : product!.specs;
    expect(storedSpecs).toEqual(
      expect.arrayContaining([expect.objectContaining({ key: 'Capacité', value: '32 Go' })])
    );
  });
});

// ===========================================================================
// AC2 — BACKEND API: PUT /api/seller/products/{id}
// ===========================================================================

test.describe('Story 2.3 — Backend API: PUT /api/seller/products/{id}', () => {
  test('API updates product and returns 200 with updated resource', async ({ page }) => {
    // === SETUP ===
    const { token, userId } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);
    const { id: productId } = await createProductViaAPI(page, token);
    const newName = uniqueProductName('API-Update');

    // === ACTION ===
    const response = await page.request.put(`${API_URL}/seller/products/${productId}`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      multipart: {
        name: newName,
        description: 'Updated via API test',
        category: 'gpu',
        price: '999.99',
        stock_quantity: '7',
        specs: JSON.stringify([{ key: 'VRAM', value: '16 Go' }]),
      },
    });

    // === VÉRIFICATION API ===
    expect(response.status()).toBe(200);
    const json = await response.json();
    expect(json.data).toBeDefined();
    expect(json.data.name).toBe(newName);
    expect(json.data.id).toBe(productId);

    // === VÉRIFICATION DB ===
    const product = await db.findOne('products', { id: productId });
    expect(product).toBeTruthy();
    expect(product!.name).toBe(newName);
    expect(product!.description).toBe('Updated via API test');
    expect(product!.category).toBe('gpu');
    expect(Number(product!.price)).toBeCloseTo(999.99, 2);
    expect(product!.stock_quantity).toBe(7);
    expect(product!.user_id).toBe(userId);
  });

  test('API GET /api/seller/products/{id} returns product data', async ({ page }) => {
    // === SETUP ===
    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);
    const productName = uniqueProductName('API-Show');
    const { id: productId } = await createProductViaAPI(page, token, {
      name: productName,
      description: 'Show endpoint test',
      category: 'ram',
      price: '89.99',
      stock_quantity: '50',
      specs: [{ key: 'Type', value: 'DDR5' }],
    });

    // === ACTION ===
    const response = await page.request.get(`${API_URL}/seller/products/${productId}`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    // === VÉRIFICATION API ===
    expect(response.status()).toBe(200);
    const json = await response.json();
    const data = json.data;

    expect(data.id).toBe(productId);
    expect(data.name).toBe(productName);
    expect(data.description).toBe('Show endpoint test');
    expect(data.category).toBe('ram');
    expect(Number(data.price)).toBeCloseTo(89.99, 2);
    expect(data.stock_quantity).toBe(50);
    expect(data).toHaveProperty('photo_url');
    expect(data).toHaveProperty('is_active');
  });

  test('API update without photo keeps original photo_path', async ({ page }) => {
    // === SETUP ===
    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);
    const { id: productId } = await createProductViaAPI(page, token);
    const originalProduct = await db.findOne('products', { id: productId });
    const originalPhotoPath = originalProduct!.photo_path;

    // === ACTION ===
    const response = await page.request.put(`${API_URL}/seller/products/${productId}`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      multipart: {
        name: uniqueProductName('API-No-Photo'),
        description: 'Update without photo replacement',
        category: 'cpu',
        price: '299.99',
        stock_quantity: '15',
        specs: JSON.stringify([]),
      },
    });

    // === VÉRIFICATION ===
    expect(response.status()).toBe(200);

    // === VÉRIFICATION DB ===
    const updatedProduct = await db.findOne('products', { id: productId });
    expect(updatedProduct!.photo_path).toBe(originalPhotoPath);
  });

  test('API update with new photo replaces photo_path', async ({ page }) => {
    // === SETUP ===
    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);
    const { id: productId } = await createProductViaAPI(page, token);
    const originalProduct = await db.findOne('products', { id: productId });
    const originalPhotoPath = originalProduct!.photo_path;

    // === ACTION ===
    const response = await page.request.put(`${API_URL}/seller/products/${productId}`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      multipart: {
        name: uniqueProductName('API-New-Photo'),
        description: 'Update with new photo',
        category: 'cpu',
        price: '299.99',
        stock_quantity: '15',
        specs: JSON.stringify([]),
        photo: {
          name: 'new-photo.png',
          mimeType: 'image/png',
          buffer: createTestImageBuffer(),
        },
      },
    });

    // === VÉRIFICATION ===
    expect(response.status()).toBe(200);

    // === VÉRIFICATION DB ===
    const updatedProduct = await db.findOne('products', { id: productId });
    expect(updatedProduct!.photo_path).toBeTruthy();
    expect(updatedProduct!.photo_path).not.toBe(originalPhotoPath);
  });

  test('API returns 401 for unauthenticated update request', async ({ page }) => {
    // === SETUP ===
    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);
    const { id: productId } = await createProductViaAPI(page, token);

    // === ACTION ===
    const response = await page.request.put(`${API_URL}/seller/products/${productId}`, {
      headers: { Accept: 'application/json' },
      multipart: {
        name: 'Unauthorized update attempt',
        description: 'Should fail',
        category: 'cpu',
        price: '100',
        stock_quantity: '1',
      },
    });

    // === VÉRIFICATION ===
    expect(response.status()).toBe(401);
  });
});

// ===========================================================================
// AC2 — VALIDATION: client & server-side validation on edit
// ===========================================================================

test.describe('Story 2.3 — AC2: Validation errors on edit form', () => {
  test('clearing name and submitting shows name required error', async ({ page }) => {
    // === SETUP ===
    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);
    const { id: productId } = await createProductViaAPI(page, token);

    // === ACTION ===
    await page.goto(`/seller/products/${productId}/edit`);
    await expect(page.locator('[data-testid="product-form"]')).toBeVisible({ timeout: 10_000 });

    await page.locator('[data-testid="product-name-input"]').clear();
    await page.locator('[data-testid="product-submit-btn"]').click();

    // === VÉRIFICATION UI ===
    await expect(page.locator('[data-testid="product-name-error"]')).toBeVisible();
    const errorText = await page.locator('[data-testid="product-name-error"]').textContent();
    expect(errorText).toMatch(/nom.*requis/i);
  });

  test('clearing description and submitting shows description required error', async ({
    page,
  }) => {
    // === SETUP ===
    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);
    const { id: productId } = await createProductViaAPI(page, token);

    // === ACTION ===
    await page.goto(`/seller/products/${productId}/edit`);
    await expect(page.locator('[data-testid="product-form"]')).toBeVisible({ timeout: 10_000 });

    await page.locator('[data-testid="product-description-input"]').clear();
    await page.locator('[data-testid="product-submit-btn"]').click();

    // === VÉRIFICATION UI ===
    await expect(page.locator('[data-testid="product-description-error"]')).toBeVisible();
    const errorText = await page.locator('[data-testid="product-description-error"]').textContent();
    expect(errorText).toMatch(/description.*requis/i);
  });

  test('setting price to 0 shows validation error', async ({ page }) => {
    // === SETUP ===
    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);
    const { id: productId } = await createProductViaAPI(page, token);

    // === ACTION ===
    await page.goto(`/seller/products/${productId}/edit`);
    await expect(page.locator('[data-testid="product-form"]')).toBeVisible({ timeout: 10_000 });

    await page.locator('[data-testid="product-price-input"]').clear();
    await page.locator('[data-testid="product-price-input"]').fill('0');
    await page.locator('[data-testid="product-submit-btn"]').click();

    // === VÉRIFICATION UI ===
    await expect(page.locator('[data-testid="product-price-error"]')).toBeVisible();
    const errorText = await page.locator('[data-testid="product-price-error"]').textContent();
    expect(errorText).toMatch(/supérieur.*0/i);
  });

  test('setting negative price shows validation error', async ({ page }) => {
    // === SETUP ===
    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);
    const { id: productId } = await createProductViaAPI(page, token);

    // === ACTION ===
    await page.goto(`/seller/products/${productId}/edit`);
    await expect(page.locator('[data-testid="product-form"]')).toBeVisible({ timeout: 10_000 });

    await page.locator('[data-testid="product-price-input"]').clear();
    await page.locator('[data-testid="product-price-input"]').fill('-50');
    await page.locator('[data-testid="product-submit-btn"]').click();

    // === VÉRIFICATION UI ===
    await expect(page.locator('[data-testid="product-price-error"]')).toBeVisible();
  });

  test('setting negative stock shows validation error', async ({ page }) => {
    // === SETUP ===
    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);
    const { id: productId } = await createProductViaAPI(page, token);

    // === ACTION ===
    await page.goto(`/seller/products/${productId}/edit`);
    await expect(page.locator('[data-testid="product-form"]')).toBeVisible({ timeout: 10_000 });

    await page.locator('[data-testid="product-stock-input"]').clear();
    await page.locator('[data-testid="product-stock-input"]').fill('-1');
    await page.locator('[data-testid="product-submit-btn"]').click();

    // === VÉRIFICATION UI ===
    await expect(page.locator('[data-testid="product-stock-error"]')).toBeVisible();
  });

  test('validation errors prevent form submission (no DB update)', async ({ page }) => {
    // === SETUP ===
    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);
    const originalName = uniqueProductName('NoUpdate-Validation');
    const { id: productId } = await createProductViaAPI(page, token, { name: originalName });

    // === ACTION ===
    await page.goto(`/seller/products/${productId}/edit`);
    await expect(page.locator('[data-testid="product-form"]')).toBeVisible({ timeout: 10_000 });

    // Clear name (make invalid) and submit
    await page.locator('[data-testid="product-name-input"]').clear();
    await page.locator('[data-testid="product-submit-btn"]').click();

    // === VÉRIFICATION UI ===
    await expect(page.locator('[data-testid="product-form-general-error"]')).toBeVisible();

    // === VÉRIFICATION DB ===
    // Product name should NOT have changed
    const product = await db.findOne('products', { id: productId });
    expect(product!.name).toBe(originalName);
  });

  test('API returns 422 for missing required fields on update', async ({ page }) => {
    // === SETUP ===
    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);
    const { id: productId } = await createProductViaAPI(page, token);

    // === ACTION ===
    const response = await page.request.put(`${API_URL}/seller/products/${productId}`, {
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
    expect(json.errors).toBeDefined();
    expect(json.errors.name).toBeDefined();
    expect(json.errors.description).toBeDefined();
    expect(json.errors.category).toBeDefined();
    expect(json.errors.price).toBeDefined();
    expect(json.errors.stock_quantity).toBeDefined();
  });

  test('API returns 422 for invalid price on update', async ({ page }) => {
    // === SETUP ===
    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);
    const { id: productId } = await createProductViaAPI(page, token);

    // === ACTION ===
    const response = await page.request.put(`${API_URL}/seller/products/${productId}`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      multipart: {
        name: 'Valid name',
        description: 'Valid description',
        category: 'cpu',
        price: '-10',
        stock_quantity: '5',
      },
    });

    // === VÉRIFICATION ===
    expect(response.status()).toBe(422);
    const json = await response.json();
    expect(json.errors.price).toBeDefined();
  });

  test('API returns 422 for invalid category on update', async ({ page }) => {
    // === SETUP ===
    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);
    const { id: productId } = await createProductViaAPI(page, token);

    // === ACTION ===
    const response = await page.request.put(`${API_URL}/seller/products/${productId}`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      multipart: {
        name: 'Valid name',
        description: 'Valid description',
        category: 'invalid_category_xyz',
        price: '100',
        stock_quantity: '5',
      },
    });

    // === VÉRIFICATION ===
    expect(response.status()).toBe(422);
    const json = await response.json();
    expect(json.errors.category).toBeDefined();
  });

  test('server-side validation errors are displayed in the edit form UI', async ({ page }) => {
    // === SETUP ===
    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);
    const { id: productId } = await createProductViaAPI(page, token);

    await page.goto(`/seller/products/${productId}/edit`);
    await expect(page.locator('[data-testid="product-form"]')).toBeVisible({ timeout: 10_000 });

    // Intercept the API call to return a 422
    await page.route(`${API_URL}/seller/products/${productId}`, (route) => {
      if (route.request().method() === 'PUT') {
        route.fulfill({
          status: 422,
          contentType: 'application/json',
          body: JSON.stringify({
            message: 'The given data was invalid.',
            errors: {
              name: ['Ce nom de produit est déjà utilisé.'],
              price: ['Le prix doit être supérieur à 0.'],
            },
          }),
        });
      } else {
        route.continue();
      }
    });

    // === ACTION ===
    await page.locator('[data-testid="product-submit-btn"]').click();

    // === VÉRIFICATION UI ===
    await expect(page.locator('[data-testid="product-name-error"]')).toBeVisible({ timeout: 10_000 });
    const nameError = await page.locator('[data-testid="product-name-error"]').textContent();
    expect(nameError).toContain('déjà utilisé');

    await expect(page.locator('[data-testid="product-price-error"]')).toBeVisible();
    const priceError = await page.locator('[data-testid="product-price-error"]').textContent();
    expect(priceError).toContain('supérieur à 0');
  });
});

// ===========================================================================
// AC3 — OWNERSHIP: seller cannot edit another seller's product
// ===========================================================================

test.describe('Story 2.3 — AC3: Ownership check (403 for another seller)', () => {
  test('API returns 403 when vendeur tries to GET another vendeur\'s product', async ({ page }) => {
    // === SETUP: Create product as vendeur1 ===
    const { token: token1 } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);
    const { id: productId } = await createProductViaAPI(page, token1);

    // Register & login as vendeur2
    const vendeur2Email = `e2e-vendeur2-edit-${Date.now()}@test.com`;
    await page.request.post(`${API_URL}/auth/register`, {
      data: {
        email: vendeur2Email,
        password: 'password',
        password_confirmation: 'password',
        role: 'vendeur',
        name: 'E2E Vendeur2 Edit',
      },
    });
    const { token: token2 } = await loginAs(page, vendeur2Email, 'password');

    // === ACTION ===
    const response = await page.request.get(`${API_URL}/seller/products/${productId}`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token2}`,
      },
    });

    // === VÉRIFICATION ===
    expect(response.status()).toBe(403);

    // Cleanup vendeur2
    await db.query(
      'DELETE FROM products WHERE user_id IN (SELECT id FROM users WHERE email = ?)',
      [vendeur2Email]
    );
    await db.query('DELETE FROM users WHERE email = ?', [vendeur2Email]);
  });

  test('API returns 403 when vendeur tries to PUT another vendeur\'s product', async ({ page }) => {
    // === SETUP: Create product as vendeur1 ===
    const { token: token1 } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);
    const originalName = uniqueProductName('Ownership-Orig');
    const { id: productId } = await createProductViaAPI(page, token1, { name: originalName });

    // Register & login as vendeur2
    const vendeur2Email = `e2e-vendeur2-put-${Date.now()}@test.com`;
    await page.request.post(`${API_URL}/auth/register`, {
      data: {
        email: vendeur2Email,
        password: 'password',
        password_confirmation: 'password',
        role: 'vendeur',
        name: 'E2E Vendeur2 Put',
      },
    });
    const { token: token2 } = await loginAs(page, vendeur2Email, 'password');

    // === ACTION ===
    const response = await page.request.put(`${API_URL}/seller/products/${productId}`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token2}`,
      },
      multipart: {
        name: 'Hijacked product name',
        description: 'This should fail',
        category: 'cpu',
        price: '1',
        stock_quantity: '1',
      },
    });

    // === VÉRIFICATION API ===
    expect(response.status()).toBe(403);

    // === VÉRIFICATION DB: product was NOT modified ===
    const product = await db.findOne('products', { id: productId });
    expect(product!.name).toBe(originalName);

    // Cleanup vendeur2
    await db.query(
      'DELETE FROM products WHERE user_id IN (SELECT id FROM users WHERE email = ?)',
      [vendeur2Email]
    );
    await db.query('DELETE FROM users WHERE email = ?', [vendeur2Email]);
  });

  test('API returns 403 when acheteur tries to update a product', async ({ page }) => {
    // === SETUP ===
    const { token: vendeurToken } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);
    const { id: productId } = await createProductViaAPI(page, vendeurToken);

    const { token: acheteurToken } = await loginAs(page, ACHETEUR_EMAIL, ACHETEUR_PASSWORD);

    // === ACTION ===
    const response = await page.request.put(`${API_URL}/seller/products/${productId}`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${acheteurToken}`,
      },
      multipart: {
        name: 'Acheteur hijack attempt',
        description: 'Should fail',
        category: 'cpu',
        price: '1',
        stock_quantity: '1',
      },
    });

    // === VÉRIFICATION ===
    expect(response.status()).toBe(403);
  });

  test('edit form shows error when navigating to another seller\'s product', async ({ page }) => {
    // === SETUP: Create product as vendeur1 ===
    const { token: token1 } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);
    const { id: productId } = await createProductViaAPI(page, token1);

    // Register & login as vendeur2
    const vendeur2Email = `e2e-vendeur2-ui-${Date.now()}@test.com`;
    await page.request.post(`${API_URL}/auth/register`, {
      data: {
        email: vendeur2Email,
        password: 'password',
        password_confirmation: 'password',
        role: 'vendeur',
        name: 'E2E Vendeur2 UI',
      },
    });
    await loginAs(page, vendeur2Email, 'password');

    // === ACTION ===
    await page.goto(`/seller/products/${productId}/edit`);

    // === VÉRIFICATION UI ===
    // Should show an error (product not found / unauthorized)
    await expect(page.locator('[data-testid="product-form-load-error"]')).toBeVisible({
      timeout: 10_000,
    });
    // The form should NOT be visible
    await expect(page.locator('[data-testid="product-form"]')).not.toBeVisible();

    // Cleanup vendeur2
    await db.query(
      'DELETE FROM products WHERE user_id IN (SELECT id FROM users WHERE email = ?)',
      [vendeur2Email]
    );
    await db.query('DELETE FROM users WHERE email = ?', [vendeur2Email]);
  });

  test('back button on load error navigates to dashboard', async ({ page }) => {
    // === SETUP ===
    await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);

    // === ACTION: navigate to a non-existent product ===
    await page.goto('/seller/products/999999/edit');

    // === VÉRIFICATION UI ===
    await expect(page.locator('[data-testid="product-form-load-error"]')).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.locator('[data-testid="product-form-back-btn"]')).toBeVisible();

    // Click back
    await page.locator('[data-testid="product-form-back-btn"]').click();

    // Should navigate to dashboard
    await page.waitForURL('**/seller/dashboard', { timeout: 10_000 });
    await expect(page.locator('[data-testid="seller-dashboard-title"]')).toBeVisible();
  });

  test('API returns 404 for non-existent product ID', async ({ page }) => {
    // === SETUP ===
    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);

    // === ACTION ===
    const response = await page.request.get(`${API_URL}/seller/products/999999`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    // === VÉRIFICATION ===
    // Could be 404 (not found) or 403 (ownership scoped query returns nothing)
    expect([403, 404]).toContain(response.status());
  });
});

// ===========================================================================
// NAVIGATION — Cancel button on edit form
// ===========================================================================

test.describe('Story 2.3 — Navigation: Cancel on edit form', () => {
  test('cancel button navigates back to seller dashboard from edit form', async ({ page }) => {
    // === SETUP ===
    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);
    const { id: productId } = await createProductViaAPI(page, token);

    await page.goto(`/seller/products/${productId}/edit`);
    await expect(page.locator('[data-testid="product-form"]')).toBeVisible({ timeout: 10_000 });

    // === ACTION ===
    await page.locator('[data-testid="product-cancel-btn"]').click();

    // === VÉRIFICATION UI ===
    await page.waitForURL('**/seller/dashboard', { timeout: 10_000 });
    await expect(page.locator('[data-testid="seller-dashboard-title"]')).toBeVisible();
  });

  test('cancel does NOT update the product in DB', async ({ page }) => {
    // === SETUP ===
    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);
    const originalName = uniqueProductName('Cancel-No-Update');
    const { id: productId } = await createProductViaAPI(page, token, { name: originalName });

    await page.goto(`/seller/products/${productId}/edit`);
    await expect(page.locator('[data-testid="product-form"]')).toBeVisible({ timeout: 10_000 });

    // Modify a field but cancel
    await page.locator('[data-testid="product-name-input"]').clear();
    await page.locator('[data-testid="product-name-input"]').fill('Modified but cancelled');

    // === ACTION ===
    await page.locator('[data-testid="product-cancel-btn"]').click();

    // === VÉRIFICATION DB ===
    const product = await db.findOne('products', { id: productId });
    expect(product!.name).toBe(originalName);
  });
});

// ===========================================================================
// ROLE PROTECTION — Only vendeur can access product edit page
// ===========================================================================

test.describe('Story 2.3 — Role protection: only vendeur can access edit form', () => {
  test('acheteur accessing /seller/products/{id}/edit is redirected to /unauthorized', async ({
    page,
  }) => {
    // === SETUP ===
    await loginAs(page, ACHETEUR_EMAIL, ACHETEUR_PASSWORD);

    // === ACTION ===
    await page.goto('/seller/products/1/edit');

    // === VÉRIFICATION UI ===
    await page.waitForURL((url) => url.pathname.includes('/unauthorized'), {
      timeout: 10_000,
    });
    await expect(page.locator('[data-testid="product-form-title"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="product-form"]')).not.toBeVisible();
  });

  test('visitor (not logged in) accessing /seller/products/{id}/edit is redirected to /login', async ({
    page,
  }) => {
    // === ACTION ===
    await page.goto('/seller/products/1/edit');

    // === VÉRIFICATION UI ===
    await page.waitForURL((url) => url.pathname.includes('/login'), {
      timeout: 10_000,
    });
    await expect(page.locator('[data-testid="product-form-title"]')).not.toBeVisible();
  });

  test('admin accessing /seller/products/{id}/edit is redirected to /unauthorized', async ({
    page,
  }) => {
    // === SETUP ===
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);

    // === ACTION ===
    await page.goto('/seller/products/1/edit');

    // === VÉRIFICATION UI ===
    await page.waitForURL((url) => url.pathname.includes('/unauthorized'), {
      timeout: 10_000,
    });
    await expect(page.locator('[data-testid="product-form-title"]')).not.toBeVisible();
  });
});

// ===========================================================================
// DB VERIFICATION — Data integrity after update
// ===========================================================================

test.describe('Story 2.3 — DB verification: data integrity after update', () => {
  test('product is_active status is preserved after update', async ({ page }) => {
    // === SETUP ===
    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);
    const { id: productId } = await createProductViaAPI(page, token);

    // Verify product is active by default
    const originalProduct = await db.findOne('products', { id: productId });
    expect(originalProduct!.is_active).toBeTruthy();

    // === ACTION ===
    const response = await page.request.put(`${API_URL}/seller/products/${productId}`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      multipart: {
        name: uniqueProductName('Preserve-Status'),
        description: 'Checking is_active preservation',
        category: 'cpu',
        price: '100',
        stock_quantity: '10',
        specs: JSON.stringify([]),
      },
    });

    expect(response.status()).toBe(200);

    // === VÉRIFICATION DB ===
    const updatedProduct = await db.findOne('products', { id: productId });
    expect(updatedProduct!.is_active).toBeTruthy();
  });

  test('product timestamps are updated correctly after edit', async ({ page }) => {
    // === SETUP ===
    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);
    const { id: productId } = await createProductViaAPI(page, token);

    const originalProduct = await db.findOne('products', { id: productId });
    const originalUpdatedAt = originalProduct!.updated_at;

    // Small delay to ensure timestamp difference
    await new Promise((resolve) => setTimeout(resolve, 1100));

    // === ACTION ===
    const response = await page.request.put(`${API_URL}/seller/products/${productId}`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      multipart: {
        name: uniqueProductName('Timestamp-Check'),
        description: 'Checking updated_at',
        category: 'cpu',
        price: '100',
        stock_quantity: '10',
        specs: JSON.stringify([]),
      },
    });

    expect(response.status()).toBe(200);

    // === VÉRIFICATION DB ===
    const updatedProduct = await db.findOne('products', { id: productId });
    const newUpdatedAt = updatedProduct!.updated_at;

    // updated_at should be different (later) than the original
    expect(new Date(newUpdatedAt).getTime()).toBeGreaterThan(
      new Date(originalUpdatedAt).getTime()
    );
  });

  test('foreign key (user_id) remains valid after update', async ({ page }) => {
    // === SETUP ===
    const { token, userId } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);
    const { id: productId } = await createProductViaAPI(page, token);

    // === ACTION ===
    const response = await page.request.put(`${API_URL}/seller/products/${productId}`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      multipart: {
        name: uniqueProductName('FK-Valid'),
        description: 'FK validation',
        category: 'cpu',
        price: '100',
        stock_quantity: '10',
        specs: JSON.stringify([]),
      },
    });

    expect(response.status()).toBe(200);

    // === VÉRIFICATION DB ===
    const product = await db.findOne('products', { id: productId });
    expect(product!.user_id).toBe(userId);

    // Verify user exists (no orphan FK)
    const user = await db.findOne('users', { id: product!.user_id });
    expect(user).toBeTruthy();
    expect(user!.role).toBe('vendeur');
  });
});
