import { test, expect } from '@playwright/test';
import { db } from '../helpers/database';

/**
 * Story 1.1 — User Registration with Role Selection
 *
 * AC1: Visitor registers with email, password, confirmation, role → account created,
 *      password hashed with bcrypt, auto-logged in, redirected to homepage
 * AC2: Duplicate email → error message
 * AC3: Invalid password (< 8 chars) → error message
 */

// ---------------------------------------------------------------------------
// Unique email generator to avoid collisions between test runs
// ---------------------------------------------------------------------------
function uniqueEmail(label: string): string {
  const ts = Date.now();
  return `e2e-${label}-${ts}@test.com`;
}

// ---------------------------------------------------------------------------
// Cleanup: remove users created during this test suite & close DB pool
// ---------------------------------------------------------------------------
test.afterAll(async () => {
  // Delete any test users created by this suite (pattern: e2e-reg-*)
  await db.query("DELETE FROM users WHERE email LIKE 'e2e-reg-%'");
  await db.cleanup();
});

// ===========================================================================
// PAGE STRUCTURE & NAVIGATION
// ===========================================================================

test.describe('Story 1.1 — Registration page structure', () => {
  test('registration page is accessible via /register route', async ({ page }) => {
    await page.goto('/register');

    // Page title and subtitle are visible
    await expect(page.locator('[data-testid="register-title"]')).toBeVisible();
    await expect(page.locator('[data-testid="register-title"]')).toHaveText('Créer un compte');
    await expect(page.locator('[data-testid="register-subtitle"]')).toBeVisible();
  });

  test('registration page is accessible via navbar link', async ({ page }) => {
    await page.goto('/');

    // Click the "S'inscrire" link in the navbar
    await page.locator('[data-testid="nav-register-link"]').click();

    // Should navigate to /register
    await page.waitForURL('**/register');
    await expect(page.locator('[data-testid="register-form"]')).toBeVisible();
  });

  test('registration form displays all required fields', async ({ page }) => {
    await page.goto('/register');

    // All form inputs are present
    await expect(page.locator('[data-testid="email-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="password-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="password-confirmation-input"]')).toBeVisible();

    // Role selection buttons are present
    await expect(page.locator('[data-testid="role-acheteur-btn"]')).toBeVisible();
    await expect(page.locator('[data-testid="role-vendeur-btn"]')).toBeVisible();

    // Submit button is present
    await expect(page.locator('[data-testid="register-submit-btn"]')).toBeVisible();

    // Login link is present
    await expect(page.locator('[data-testid="login-link"]')).toBeVisible();
  });
});

// ===========================================================================
// AC1 — HAPPY PATH: Successful registration
// ===========================================================================

test.describe('Story 1.1 — AC1: Successful registration', () => {
  test('register as acheteur → account created, hashed password, auto-login, redirect to homepage', async ({
    page,
  }) => {
    const email = uniqueEmail('reg-acheteur');
    const password = 'SecureP@ss123';

    await page.goto('/register');

    // Fill in the form
    await page.locator('[data-testid="email-input"]').fill(email);
    await page.locator('[data-testid="password-input"]').fill(password);
    await page.locator('[data-testid="password-confirmation-input"]').fill(password);
    await page.locator('[data-testid="role-acheteur-btn"]').click();

    // Submit
    await page.locator('[data-testid="register-submit-btn"]').click();

    // === VÉRIFICATION UI ===
    // User should be redirected to the homepage (away from /register)
    await page.waitForURL((url) => !url.pathname.includes('/register'), {
      timeout: 10_000,
    });

    // === VÉRIFICATION DB ===
    // User record exists with correct role
    const user = await db.assertExists('users', { email });
    expect(user.role).toBe('acheteur');

    // Password is hashed (bcrypt hashes start with $2y$ or $2b$ or $2a$)
    expect(user.password).toMatch(/^\$2[aby]\$/);

    // Password is NOT stored in plain text
    expect(user.password).not.toBe(password);

    // === VÉRIFICATION AUTH ===
    // User should be auto-logged in — check that a token was created
    const tokens = await db.query(
      'SELECT * FROM oauth_access_tokens WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
      [user.id]
    );
    expect(tokens.length).toBeGreaterThan(0);
    expect(tokens[0].revoked).toBe(0);
  });

  test('register as vendeur → account created with vendeur role', async ({ page }) => {
    const email = uniqueEmail('reg-vendeur');
    const password = 'SecureP@ss456';

    await page.goto('/register');

    // Fill in the form
    await page.locator('[data-testid="email-input"]').fill(email);
    await page.locator('[data-testid="password-input"]').fill(password);
    await page.locator('[data-testid="password-confirmation-input"]').fill(password);
    await page.locator('[data-testid="role-vendeur-btn"]').click();

    // Submit
    await page.locator('[data-testid="register-submit-btn"]').click();

    // === VÉRIFICATION UI ===
    await page.waitForURL((url) => !url.pathname.includes('/register'), {
      timeout: 10_000,
    });

    // === VÉRIFICATION DB ===
    const user = await db.assertExists('users', { email });
    expect(user.role).toBe('vendeur');

    // Password hashed with bcrypt
    expect(user.password).toMatch(/^\$2[aby]\$/);
  });

  test('after successful registration, user is auto-logged in (token in localStorage)', async ({
    page,
  }) => {
    const email = uniqueEmail('reg-autologin');
    const password = 'SecureP@ss789';

    await page.goto('/register');

    await page.locator('[data-testid="email-input"]').fill(email);
    await page.locator('[data-testid="password-input"]').fill(password);
    await page.locator('[data-testid="password-confirmation-input"]').fill(password);
    await page.locator('[data-testid="role-acheteur-btn"]').click();
    await page.locator('[data-testid="register-submit-btn"]').click();

    // === VÉRIFICATION UI ===
    // Should redirect to homepage
    await page.waitForURL((url) => !url.pathname.includes('/register'), {
      timeout: 10_000,
    });

    // === VÉRIFICATION: token stored in localStorage (auto-login) ===
    const token = await page.evaluate(() => localStorage.getItem('token'));
    expect(token).toBeTruthy();
    expect(typeof token).toBe('string');
    expect(token!.length).toBeGreaterThan(0);
  });
});

// ===========================================================================
// AC2 — Duplicate email
// ===========================================================================

test.describe('Story 1.1 — AC2: Duplicate email', () => {
  test('registering with an already used email shows error message', async ({ page }) => {
    const email = uniqueEmail('reg-dup');
    const password = 'SecureP@ss123';

    // --- First registration: should succeed ---
    await page.goto('/register');
    await page.locator('[data-testid="email-input"]').fill(email);
    await page.locator('[data-testid="password-input"]').fill(password);
    await page.locator('[data-testid="password-confirmation-input"]').fill(password);
    await page.locator('[data-testid="role-acheteur-btn"]').click();
    await page.locator('[data-testid="register-submit-btn"]').click();

    await page.waitForURL((url) => !url.pathname.includes('/register'), {
      timeout: 10_000,
    });

    // --- Second registration with same email: should fail ---
    await page.goto('/register');
    await page.locator('[data-testid="email-input"]').fill(email);
    await page.locator('[data-testid="password-input"]').fill(password);
    await page.locator('[data-testid="password-confirmation-input"]').fill(password);
    await page.locator('[data-testid="role-vendeur-btn"]').click();
    await page.locator('[data-testid="register-submit-btn"]').click();

    // === VÉRIFICATION UI ===
    // Error message should indicate the email is already taken
    const emailError = page.locator('[data-testid="email-error"]');
    await expect(emailError).toBeVisible({ timeout: 5_000 });
    await expect(emailError).toContainText(/déjà|already|existe|taken|utilisé/i);

    // Should still be on the register page
    expect(page.url()).toContain('/register');

    // === VÉRIFICATION DB ===
    // Only ONE user with this email should exist
    const userCount = await db.count('users', { email });
    expect(userCount).toBe(1);
  });
});

// ===========================================================================
// AC3 — Invalid password (< 8 characters)
// ===========================================================================

test.describe('Story 1.1 — AC3: Invalid password', () => {
  test('password shorter than 8 characters shows client-side error', async ({ page }) => {
    await page.goto('/register');

    // Enter a short password
    await page.locator('[data-testid="password-input"]').fill('Short1');

    // === VÉRIFICATION UI ===
    const passwordError = page.locator('[data-testid="password-error"]');
    await expect(passwordError).toBeVisible({ timeout: 5_000 });
    await expect(passwordError).toContainText(/8 caractères|8 characters|minimum/i);
  });

  test('submitting form with short password does NOT create a user', async ({ page }) => {
    const email = uniqueEmail('reg-shortpw');
    const shortPassword = 'abc';

    await page.goto('/register');

    await page.locator('[data-testid="email-input"]').fill(email);
    await page.locator('[data-testid="password-input"]').fill(shortPassword);
    await page.locator('[data-testid="password-confirmation-input"]').fill(shortPassword);
    await page.locator('[data-testid="role-acheteur-btn"]').click();
    await page.locator('[data-testid="register-submit-btn"]').click();

    // Button should be disabled or the form should prevent submission
    // Wait a moment to ensure nothing happens asynchronously
    await page.waitForTimeout(1_000);

    // Should still be on /register
    expect(page.url()).toContain('/register');

    // === VÉRIFICATION DB ===
    // No user should have been created with this email
    await db.assertNotExists('users', { email });
  });

  test('server-side validation rejects password shorter than 8 characters', async ({ page }) => {
    const email = uniqueEmail('reg-srv-shortpw');

    await page.goto('/register');

    await page.locator('[data-testid="email-input"]').fill(email);
    // Use exactly 7 characters to test the boundary
    await page.locator('[data-testid="password-input"]').fill('Abcdef7');
    await page.locator('[data-testid="password-confirmation-input"]').fill('Abcdef7');
    await page.locator('[data-testid="role-vendeur-btn"]').click();
    await page.locator('[data-testid="register-submit-btn"]').click();

    // === VÉRIFICATION UI ===
    // Either client-side or server-side error about password length
    const passwordError = page.locator('[data-testid="password-error"]');
    await expect(passwordError).toBeVisible({ timeout: 5_000 });

    // Should still be on /register
    expect(page.url()).toContain('/register');

    // === VÉRIFICATION DB ===
    await db.assertNotExists('users', { email });
  });
});

// ===========================================================================
// CLIENT-SIDE VALIDATION — Edge cases
// ===========================================================================

test.describe('Story 1.1 — Client-side validation edge cases', () => {
  test('invalid email format shows error', async ({ page }) => {
    await page.goto('/register');

    await page.locator('[data-testid="email-input"]').fill('not-an-email');

    // === VÉRIFICATION UI ===
    const emailError = page.locator('[data-testid="email-error"]');
    await expect(emailError).toBeVisible({ timeout: 5_000 });
    await expect(emailError).toContainText(/email valide|valid email/i);
  });

  test('password confirmation mismatch shows error', async ({ page }) => {
    await page.goto('/register');

    await page.locator('[data-testid="password-input"]').fill('SecureP@ss123');
    await page.locator('[data-testid="password-confirmation-input"]').fill('DifferentP@ss');

    // === VÉRIFICATION UI ===
    const confirmError = page.locator('[data-testid="password-confirmation-error"]');
    await expect(confirmError).toBeVisible({ timeout: 5_000 });
    await expect(confirmError).toContainText(/correspondent|match|identiques/i);
  });

  test('submitting empty form shows general error', async ({ page }) => {
    await page.goto('/register');

    // Click submit without filling anything
    await page.locator('[data-testid="register-submit-btn"]').click();

    // === VÉRIFICATION UI ===
    const generalError = page.locator('[data-testid="general-error-message"]');
    await expect(generalError).toBeVisible({ timeout: 5_000 });
    await expect(generalError).toContainText(/remplir|required|obligatoire/i);

    // Should still be on /register
    expect(page.url()).toContain('/register');
  });

  test('submitting form without selecting role shows error', async ({ page }) => {
    const email = uniqueEmail('reg-norole');
    const password = 'SecureP@ss123';

    await page.goto('/register');

    await page.locator('[data-testid="email-input"]').fill(email);
    await page.locator('[data-testid="password-input"]').fill(password);
    await page.locator('[data-testid="password-confirmation-input"]').fill(password);
    // Do NOT select a role

    await page.locator('[data-testid="register-submit-btn"]').click();

    // === VÉRIFICATION UI ===
    // Should display an error (general or role-specific)
    const generalError = page.locator('[data-testid="general-error-message"]');
    const roleError = page.locator('[data-testid="role-error"]');

    // At least one of these errors should be visible
    const isGeneralVisible = await generalError.isVisible().catch(() => false);
    const isRoleVisible = await roleError.isVisible().catch(() => false);
    expect(isGeneralVisible || isRoleVisible).toBe(true);

    // Should still be on /register
    expect(page.url()).toContain('/register');

    // === VÉRIFICATION DB ===
    await db.assertNotExists('users', { email });
  });
});

// ===========================================================================
// ROLE SELECTION — UI behavior
// ===========================================================================

test.describe('Story 1.1 — Role selection UI', () => {
  test('clicking acheteur button selects acheteur role visually', async ({ page }) => {
    await page.goto('/register');

    const acheteurBtn = page.locator('[data-testid="role-acheteur-btn"]');
    const vendeurBtn = page.locator('[data-testid="role-vendeur-btn"]');

    // Click acheteur
    await acheteurBtn.click();

    // Acheteur should have the selected visual state (indigo border)
    await expect(acheteurBtn).toHaveClass(/border-indigo/);
    // Vendeur should NOT have the selected state
    await expect(vendeurBtn).not.toHaveClass(/border-indigo/);
  });

  test('clicking vendeur button selects vendeur role visually', async ({ page }) => {
    await page.goto('/register');

    const acheteurBtn = page.locator('[data-testid="role-acheteur-btn"]');
    const vendeurBtn = page.locator('[data-testid="role-vendeur-btn"]');

    // Click vendeur
    await vendeurBtn.click();

    // Vendeur should have the selected state
    await expect(vendeurBtn).toHaveClass(/border-indigo/);
    // Acheteur should NOT
    await expect(acheteurBtn).not.toHaveClass(/border-indigo/);
  });

  test('switching role selection deselects the previous role', async ({ page }) => {
    await page.goto('/register');

    const acheteurBtn = page.locator('[data-testid="role-acheteur-btn"]');
    const vendeurBtn = page.locator('[data-testid="role-vendeur-btn"]');

    // Select acheteur first
    await acheteurBtn.click();
    await expect(acheteurBtn).toHaveClass(/border-indigo/);

    // Then switch to vendeur
    await vendeurBtn.click();
    await expect(vendeurBtn).toHaveClass(/border-indigo/);
    await expect(acheteurBtn).not.toHaveClass(/border-indigo/);
  });
});

// ===========================================================================
// LOADING STATE
// ===========================================================================

test.describe('Story 1.1 — Loading state during registration', () => {
  test('submit button shows loading spinner during API call', async ({ page }) => {
    const email = uniqueEmail('reg-loading');
    const password = 'SecureP@ss123';

    await page.goto('/register');

    await page.locator('[data-testid="email-input"]').fill(email);
    await page.locator('[data-testid="password-input"]').fill(password);
    await page.locator('[data-testid="password-confirmation-input"]').fill(password);
    await page.locator('[data-testid="role-acheteur-btn"]').click();

    // Submit the form
    await page.locator('[data-testid="register-submit-btn"]').click();

    // === VÉRIFICATION UI ===
    // During submission, the loading spinner should appear
    const spinner = page.locator('[data-testid="loading-spinner"]');
    await expect(spinner).toBeVisible({ timeout: 3_000 });

    // The submit button should be disabled during loading
    await expect(page.locator('[data-testid="register-submit-btn"]')).toBeDisabled();
  });
});

// ===========================================================================
// SECURITY — Password boundary cases
// ===========================================================================

test.describe('Story 1.1 — Password boundary cases', () => {
  test('password with exactly 8 characters is accepted', async ({ page }) => {
    const email = uniqueEmail('reg-8chars');
    const password = 'Abcdefg8'; // exactly 8 characters

    await page.goto('/register');

    await page.locator('[data-testid="email-input"]').fill(email);
    await page.locator('[data-testid="password-input"]').fill(password);
    await page.locator('[data-testid="password-confirmation-input"]').fill(password);
    await page.locator('[data-testid="role-vendeur-btn"]').click();

    // No client-side password error should be visible
    const passwordError = page.locator('[data-testid="password-error"]');
    await expect(passwordError).not.toBeVisible();

    // Submit should proceed
    await page.locator('[data-testid="register-submit-btn"]').click();

    // === VÉRIFICATION UI ===
    // Should redirect away from /register (successful registration)
    await page.waitForURL((url) => !url.pathname.includes('/register'), {
      timeout: 10_000,
    });

    // === VÉRIFICATION DB ===
    const user = await db.assertExists('users', { email });
    expect(user.password).toMatch(/^\$2[aby]\$/);
  });

  test('password with exactly 7 characters is rejected', async ({ page }) => {
    await page.goto('/register');

    const password = 'Abcdef7'; // exactly 7 characters

    await page.locator('[data-testid="password-input"]').fill(password);

    // === VÉRIFICATION UI ===
    const passwordError = page.locator('[data-testid="password-error"]');
    await expect(passwordError).toBeVisible({ timeout: 5_000 });
    await expect(passwordError).toContainText(/8 caractères|8 characters|minimum/i);
  });
});
