import { test, expect } from '@playwright/test';
import { loginAs, logout } from '../helpers/auth';
import { db } from '../helpers/database';

/**
 * Story 1.3 — User Profile Management
 *
 * AC1: Logged-in user navigates to profile page → sees email, role (readonly)
 *      and editable fields (name, etc.)
 * AC2: User edits profile information, saves → profile updated, success
 *      confirmation shown
 *
 * Pre-condition: e2e@test.com / password exists (from E2E seeder)
 */

// ---------------------------------------------------------------------------
// Cleanup: close DB pool after all tests
// ---------------------------------------------------------------------------
test.afterAll(async () => {
  await db.cleanup();
});

// ===========================================================================
// PAGE STRUCTURE & NAVIGATION
// ===========================================================================

test.describe('Story 1.3 — Profile page structure', () => {
  test('profile page is accessible via /profile route when authenticated', async ({ page }) => {
    // === SETUP: login via helper ===
    await loginAs(page, 'e2e@test.com', 'password');

    // === ACTION: navigate to profile ===
    await page.goto('/profile');

    // === VÉRIFICATION UI ===
    // Page title and subtitle are visible
    await expect(page.locator('[data-testid="profile-title"]')).toBeVisible();
    await expect(page.locator('[data-testid="profile-title"]')).toHaveText('Mon profil');
    await expect(page.locator('[data-testid="profile-subtitle"]')).toBeVisible();
  });

  test('profile page is accessible via navbar link', async ({ page }) => {
    // === SETUP: login via helper ===
    await loginAs(page, 'e2e@test.com', 'password');

    // === ACTION: click profile link in navbar ===
    await page.locator('[data-testid="nav-profile-link"]').click();

    // === VÉRIFICATION UI ===
    await page.waitForURL('**/profile');
    await expect(page.locator('[data-testid="profile-form"]')).toBeVisible();
  });

  test('profile page displays all required fields', async ({ page }) => {
    // === SETUP ===
    await loginAs(page, 'e2e@test.com', 'password');
    await page.goto('/profile');

    // === VÉRIFICATION UI ===
    // Email field (readonly)
    await expect(page.locator('[data-testid="profile-email-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="profile-email-readonly-badge"]')).toBeVisible();

    // Role field (readonly)
    await expect(page.locator('[data-testid="profile-role-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="profile-role-readonly-badge"]')).toBeVisible();

    // Name field (editable)
    await expect(page.locator('[data-testid="profile-name-input"]')).toBeVisible();

    // Action buttons
    await expect(page.locator('[data-testid="profile-cancel-btn"]')).toBeVisible();
    await expect(page.locator('[data-testid="profile-save-btn"]')).toBeVisible();
  });

  test('unauthenticated user is redirected to /login when accessing /profile', async ({
    page,
  }) => {
    // === ACTION: navigate to profile without login ===
    await page.goto('/profile');

    // === VÉRIFICATION UI ===
    // Should be redirected to /login
    await page.waitForURL((url) => url.pathname.includes('/login'), {
      timeout: 10_000,
    });
  });
});

// ===========================================================================
// AC1 — PROFILE DISPLAY: Email, role (readonly), name (editable)
// ===========================================================================

test.describe('Story 1.3 — AC1: Profile page loads with user info', () => {
  test('logged-in user sees their email displayed (readonly)', async ({ page }) => {
    // === SETUP ===
    await loginAs(page, 'e2e@test.com', 'password');
    await page.goto('/profile');

    // === VÉRIFICATION UI ===
    const emailInput = page.locator('[data-testid="profile-email-input"]');
    await expect(emailInput).toBeVisible();

    // Email should display the logged-in user's email
    await expect(emailInput).toHaveValue('e2e@test.com');

    // Email field should be disabled (readonly)
    await expect(emailInput).toBeDisabled();

    // "Non modifiable" badge should be visible
    await expect(page.locator('[data-testid="profile-email-readonly-badge"]')).toBeVisible();
    await expect(page.locator('[data-testid="profile-email-readonly-badge"]')).toContainText(
      /non modifiable/i
    );
  });

  test('logged-in user sees their role displayed (readonly)', async ({ page }) => {
    // === SETUP ===
    await loginAs(page, 'e2e@test.com', 'password');
    await page.goto('/profile');

    // === VÉRIFICATION UI ===
    const roleInput = page.locator('[data-testid="profile-role-input"]');
    await expect(roleInput).toBeVisible();

    // Role should display a human-readable role label
    // (e.g., "Acheteur", "Vendeur", or "Admin")
    const roleValue = await roleInput.inputValue();
    expect(roleValue).toMatch(/acheteur|vendeur|admin/i);

    // Role field should be disabled (readonly)
    await expect(roleInput).toBeDisabled();

    // "Non modifiable" badge should be visible
    await expect(page.locator('[data-testid="profile-role-readonly-badge"]')).toBeVisible();
  });

  test('logged-in user sees their name in an editable field', async ({ page }) => {
    // === SETUP ===
    await loginAs(page, 'e2e@test.com', 'password');
    await page.goto('/profile');

    // === VÉRIFICATION UI ===
    const nameInput = page.locator('[data-testid="profile-name-input"]');
    await expect(nameInput).toBeVisible();

    // Name field should NOT be disabled (it's editable)
    await expect(nameInput).not.toBeDisabled();

    // Name should have a value (the user's current name from DB/API)
    const nameValue = await nameInput.inputValue();
    expect(nameValue.length).toBeGreaterThan(0);

    // === VÉRIFICATION DB ===
    // The displayed name should match what's in the database
    const user = await db.findOne('users', { email: 'e2e@test.com' });
    expect(user).toBeTruthy();
    expect(nameValue).toBe(user!.name);
  });

  test('profile data matches database for logged-in user', async ({ page }) => {
    // === SETUP ===
    await loginAs(page, 'e2e@test.com', 'password');
    await page.goto('/profile');

    // === VÉRIFICATION DB ===
    const user = await db.findOne('users', { email: 'e2e@test.com' });
    expect(user).toBeTruthy();

    // === VÉRIFICATION UI vs DB ===
    // Email matches
    await expect(page.locator('[data-testid="profile-email-input"]')).toHaveValue(user!.email);

    // Name matches
    await expect(page.locator('[data-testid="profile-name-input"]')).toHaveValue(user!.name);
  });
});

// ===========================================================================
// AC2 — HAPPY PATH: Edit profile and save
// ===========================================================================

test.describe('Story 1.3 — AC2: Successful profile update', () => {
  test('user edits name, saves → success confirmation shown', async ({ page }) => {
    // === SETUP ===
    await loginAs(page, 'e2e@test.com', 'password');
    await page.goto('/profile');

    // Remember original name for cleanup
    const originalName = await page.locator('[data-testid="profile-name-input"]').inputValue();

    const newName = `E2E Updated ${Date.now()}`;

    // === ACTION UI ===
    // Clear the name field and type a new name
    await page.locator('[data-testid="profile-name-input"]').clear();
    await page.locator('[data-testid="profile-name-input"]').fill(newName);

    // Click save
    await page.locator('[data-testid="profile-save-btn"]').click();

    // === VÉRIFICATION UI ===
    // Success message should appear
    const successMessage = page.locator('[data-testid="profile-success-message"]');
    await expect(successMessage).toBeVisible({ timeout: 5_000 });
    await expect(successMessage).toContainText(/succès|mis à jour|sauvegardé|enregistré/i);

    // === VÉRIFICATION DB ===
    // The user's name should be updated in the database
    const updatedUser = await db.findOne('users', { email: 'e2e@test.com' });
    expect(updatedUser).toBeTruthy();
    expect(updatedUser!.name).toBe(newName);

    // === CLEANUP: restore original name ===
    await page.locator('[data-testid="profile-name-input"]').clear();
    await page.locator('[data-testid="profile-name-input"]').fill(originalName);
    await page.locator('[data-testid="profile-save-btn"]').click();
    await expect(successMessage).toBeVisible({ timeout: 5_000 });
  });

  test('after saving, name field retains the updated value', async ({ page }) => {
    // === SETUP ===
    await loginAs(page, 'e2e@test.com', 'password');
    await page.goto('/profile');

    const originalName = await page.locator('[data-testid="profile-name-input"]').inputValue();
    const newName = `E2E Retained ${Date.now()}`;

    // === ACTION: edit and save ===
    await page.locator('[data-testid="profile-name-input"]').clear();
    await page.locator('[data-testid="profile-name-input"]').fill(newName);
    await page.locator('[data-testid="profile-save-btn"]').click();

    // Wait for success
    await expect(page.locator('[data-testid="profile-success-message"]')).toBeVisible({
      timeout: 5_000,
    });

    // === VÉRIFICATION UI ===
    // Reload page — name should persist (it was saved to API/DB)
    await page.reload();
    await expect(page.locator('[data-testid="profile-name-input"]')).toHaveValue(newName);

    // === VÉRIFICATION DB ===
    const user = await db.findOne('users', { email: 'e2e@test.com' });
    expect(user).toBeTruthy();
    expect(user!.name).toBe(newName);

    // === CLEANUP ===
    await page.locator('[data-testid="profile-name-input"]').clear();
    await page.locator('[data-testid="profile-name-input"]').fill(originalName);
    await page.locator('[data-testid="profile-save-btn"]').click();
    await expect(page.locator('[data-testid="profile-success-message"]')).toBeVisible({
      timeout: 5_000,
    });
  });

  test('email and role remain unchanged after profile update', async ({ page }) => {
    // === SETUP ===
    await loginAs(page, 'e2e@test.com', 'password');
    await page.goto('/profile');

    // Capture values before edit
    const emailBefore = await page.locator('[data-testid="profile-email-input"]').inputValue();
    const roleBefore = await page.locator('[data-testid="profile-role-input"]').inputValue();
    const originalName = await page.locator('[data-testid="profile-name-input"]').inputValue();

    // === ACTION: update name ===
    const newName = `E2E Security ${Date.now()}`;
    await page.locator('[data-testid="profile-name-input"]').clear();
    await page.locator('[data-testid="profile-name-input"]').fill(newName);
    await page.locator('[data-testid="profile-save-btn"]').click();

    await expect(page.locator('[data-testid="profile-success-message"]')).toBeVisible({
      timeout: 5_000,
    });

    // === VÉRIFICATION UI ===
    // Email is still the same
    await expect(page.locator('[data-testid="profile-email-input"]')).toHaveValue(emailBefore);
    // Role is still the same
    await expect(page.locator('[data-testid="profile-role-input"]')).toHaveValue(roleBefore);

    // === VÉRIFICATION DB ===
    // Email and role should NOT have changed in the database
    const user = await db.findOne('users', { email: 'e2e@test.com' });
    expect(user).toBeTruthy();
    expect(user!.email).toBe(emailBefore);

    // === CLEANUP ===
    await page.locator('[data-testid="profile-name-input"]').clear();
    await page.locator('[data-testid="profile-name-input"]').fill(originalName);
    await page.locator('[data-testid="profile-save-btn"]').click();
    await expect(page.locator('[data-testid="profile-success-message"]')).toBeVisible({
      timeout: 5_000,
    });
  });
});

// ===========================================================================
// AC2 — LOADING STATE
// ===========================================================================

test.describe('Story 1.3 — Loading state during profile save', () => {
  test('save button shows loading spinner during API call', async ({ page }) => {
    // === SETUP ===
    await loginAs(page, 'e2e@test.com', 'password');
    await page.goto('/profile');

    // === ACTION: change name and submit ===
    await page.locator('[data-testid="profile-name-input"]').clear();
    await page.locator('[data-testid="profile-name-input"]').fill('Loading Test');
    await page.locator('[data-testid="profile-save-btn"]').click();

    // === VÉRIFICATION UI ===
    // During submission, the loading spinner should appear
    const spinner = page.locator('[data-testid="profile-loading-spinner"]');
    await expect(spinner).toBeVisible({ timeout: 3_000 });

    // The save button should be disabled during loading
    await expect(page.locator('[data-testid="profile-save-btn"]')).toBeDisabled();
  });
});

// ===========================================================================
// AC2 — CANCEL / RESET
// ===========================================================================

test.describe('Story 1.3 — Cancel button resets form', () => {
  test('clicking cancel resets name to original value', async ({ page }) => {
    // === SETUP ===
    await loginAs(page, 'e2e@test.com', 'password');
    await page.goto('/profile');

    // Capture original name from the form
    const originalName = await page.locator('[data-testid="profile-name-input"]').inputValue();

    // === ACTION: modify name ===
    await page.locator('[data-testid="profile-name-input"]').clear();
    await page.locator('[data-testid="profile-name-input"]').fill('Should Be Cancelled');

    // Verify the name has changed in the input
    await expect(page.locator('[data-testid="profile-name-input"]')).toHaveValue(
      'Should Be Cancelled'
    );

    // === ACTION: click cancel ===
    await page.locator('[data-testid="profile-cancel-btn"]').click();

    // === VÉRIFICATION UI ===
    // Name should be reset to original value
    await expect(page.locator('[data-testid="profile-name-input"]')).toHaveValue(originalName);

    // No success message should be shown
    await expect(page.locator('[data-testid="profile-success-message"]')).not.toBeVisible();
  });

  test('clicking cancel clears any error message', async ({ page }) => {
    // === SETUP ===
    await loginAs(page, 'e2e@test.com', 'password');
    await page.goto('/profile');

    // === ACTION: trigger validation error by clearing name and saving ===
    await page.locator('[data-testid="profile-name-input"]').clear();
    await page.locator('[data-testid="profile-save-btn"]').click();

    // Error should appear
    await expect(page.locator('[data-testid="profile-error-message"]')).toBeVisible({
      timeout: 5_000,
    });

    // === ACTION: click cancel ===
    await page.locator('[data-testid="profile-cancel-btn"]').click();

    // === VÉRIFICATION UI ===
    // Error message should be cleared
    await expect(page.locator('[data-testid="profile-error-message"]')).not.toBeVisible();
  });
});

// ===========================================================================
// VALIDATION — Client-side and server-side
// ===========================================================================

test.describe('Story 1.3 — Validation: empty name', () => {
  test('saving with empty name shows error message', async ({ page }) => {
    // === SETUP ===
    await loginAs(page, 'e2e@test.com', 'password');
    await page.goto('/profile');

    // === ACTION: clear name and try to save ===
    await page.locator('[data-testid="profile-name-input"]').clear();
    await page.locator('[data-testid="profile-save-btn"]').click();

    // === VÉRIFICATION UI ===
    // Error message should be visible
    const errorMessage = page.locator('[data-testid="profile-error-message"]');
    await expect(errorMessage).toBeVisible({ timeout: 5_000 });
    await expect(errorMessage).toContainText(/nom|name|requis|required|obligatoire/i);

    // No success message should appear
    await expect(page.locator('[data-testid="profile-success-message"]')).not.toBeVisible();

    // === VÉRIFICATION DB ===
    // Name should NOT have been changed in DB
    const user = await db.findOne('users', { email: 'e2e@test.com' });
    expect(user).toBeTruthy();
    expect(user!.name).not.toBe('');
  });

  test('saving with whitespace-only name shows error message', async ({ page }) => {
    // === SETUP ===
    await loginAs(page, 'e2e@test.com', 'password');
    await page.goto('/profile');

    // === ACTION: fill with spaces only ===
    await page.locator('[data-testid="profile-name-input"]').clear();
    await page.locator('[data-testid="profile-name-input"]').fill('   ');
    await page.locator('[data-testid="profile-save-btn"]').click();

    // === VÉRIFICATION UI ===
    const errorMessage = page.locator('[data-testid="profile-error-message"]');
    await expect(errorMessage).toBeVisible({ timeout: 5_000 });

    // === VÉRIFICATION DB ===
    // Name should NOT be changed to whitespace
    const user = await db.findOne('users', { email: 'e2e@test.com' });
    expect(user).toBeTruthy();
    expect(user!.name.trim().length).toBeGreaterThan(0);
  });
});

// ===========================================================================
// SECURITY — Email and role cannot be modified
// ===========================================================================

test.describe('Story 1.3 — Security: readonly fields', () => {
  test('email input is disabled and cannot be modified', async ({ page }) => {
    // === SETUP ===
    await loginAs(page, 'e2e@test.com', 'password');
    await page.goto('/profile');

    // === VÉRIFICATION UI ===
    const emailInput = page.locator('[data-testid="profile-email-input"]');
    await expect(emailInput).toBeDisabled();

    // Try to type in the disabled field — should have no effect
    const originalEmail = await emailInput.inputValue();
    await emailInput.fill('hacker@evil.com').catch(() => {
      // Expected: fill on a disabled input may throw
    });

    // Value should remain unchanged
    const currentEmail = await emailInput.inputValue();
    expect(currentEmail).toBe(originalEmail);
  });

  test('role input is disabled and cannot be modified', async ({ page }) => {
    // === SETUP ===
    await loginAs(page, 'e2e@test.com', 'password');
    await page.goto('/profile');

    // === VÉRIFICATION UI ===
    const roleInput = page.locator('[data-testid="profile-role-input"]');
    await expect(roleInput).toBeDisabled();

    // Value should remain unchanged
    const originalRole = await roleInput.inputValue();
    expect(originalRole.length).toBeGreaterThan(0);
  });
});

// ===========================================================================
// ROUTE PROTECTION
// ===========================================================================

test.describe('Story 1.3 — Route protection', () => {
  test('unauthenticated user visiting /profile is redirected to /login', async ({ page }) => {
    // === ACTION: navigate to /profile without login ===
    await page.goto('/profile');

    // === VÉRIFICATION UI ===
    await page.waitForURL((url) => url.pathname.includes('/login'), {
      timeout: 10_000,
    });

    // Profile form should NOT be visible
    await expect(page.locator('[data-testid="profile-form"]')).not.toBeVisible();
  });

  test('after logout, accessing /profile redirects to /login', async ({ page }) => {
    // === SETUP: login then logout ===
    await loginAs(page, 'e2e@test.com', 'password');
    await logout(page);

    // === ACTION: try to access profile ===
    await page.goto('/profile');

    // === VÉRIFICATION UI ===
    await page.waitForURL((url) => url.pathname.includes('/login'), {
      timeout: 10_000,
    });
  });
});

// ===========================================================================
// NAVIGATION — Profile link visibility
// ===========================================================================

test.describe('Story 1.3 — Navigation: profile link', () => {
  test('authenticated user sees "Mon profil" link in navbar', async ({ page }) => {
    // === SETUP ===
    await loginAs(page, 'e2e@test.com', 'password');
    await page.goto('/');

    // === VÉRIFICATION UI ===
    await expect(page.locator('[data-testid="nav-profile-link"]')).toBeVisible();
    await expect(page.locator('[data-testid="nav-profile-link"]')).toContainText(/profil/i);
  });

  test('unauthenticated user does NOT see profile link in navbar', async ({ page }) => {
    // === ACTION ===
    await page.goto('/');

    // === VÉRIFICATION UI ===
    await expect(page.locator('[data-testid="nav-profile-link"]')).not.toBeVisible();
  });

  test('clicking "Mon profil" link navigates to /profile', async ({ page }) => {
    // === SETUP ===
    await loginAs(page, 'e2e@test.com', 'password');
    await page.goto('/');

    // === ACTION ===
    await page.locator('[data-testid="nav-profile-link"]').click();

    // === VÉRIFICATION UI ===
    await page.waitForURL('**/profile');
    await expect(page.locator('[data-testid="profile-title"]')).toBeVisible();
  });
});

// ===========================================================================
// SUCCESS TOAST — Auto-hide behavior
// ===========================================================================

test.describe('Story 1.3 — Success toast behavior', () => {
  test('success message disappears automatically after a few seconds', async ({ page }) => {
    // === SETUP ===
    await loginAs(page, 'e2e@test.com', 'password');
    await page.goto('/profile');

    const originalName = await page.locator('[data-testid="profile-name-input"]').inputValue();

    // === ACTION: save profile ===
    await page.locator('[data-testid="profile-name-input"]').clear();
    await page.locator('[data-testid="profile-name-input"]').fill(`Toast Test ${Date.now()}`);
    await page.locator('[data-testid="profile-save-btn"]').click();

    // Success appears
    const successMsg = page.locator('[data-testid="profile-success-message"]');
    await expect(successMsg).toBeVisible({ timeout: 5_000 });

    // === VÉRIFICATION UI ===
    // Success should auto-hide (within ~5 seconds)
    await expect(successMsg).not.toBeVisible({ timeout: 10_000 });

    // === CLEANUP ===
    await page.locator('[data-testid="profile-name-input"]').clear();
    await page.locator('[data-testid="profile-name-input"]').fill(originalName);
    await page.locator('[data-testid="profile-save-btn"]').click();
    await expect(successMsg).toBeVisible({ timeout: 5_000 });
  });
});
