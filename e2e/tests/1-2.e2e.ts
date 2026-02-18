import { test, expect } from '@playwright/test';
import { loginAs, logout } from '../helpers/auth';
import { db } from '../helpers/database';

/**
 * Story 1.2 — User Login & Logout
 *
 * AC1: Registered user logs in with valid email + password → auth token issued
 *      with expiration, redirected to homepage
 * AC2: Invalid credentials → generic error message (no field reveal)
 * AC3: Logged-in user logs out → token invalidated, redirected to homepage
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

test.describe('Story 1.2 — Login page structure', () => {
  test('login page is accessible via /login route', async ({ page }) => {
    await page.goto('/login');

    // Page title and subtitle are visible
    await expect(page.locator('[data-testid="login-title"]')).toBeVisible();
    await expect(page.locator('[data-testid="login-title"]')).toHaveText('Se connecter');
    await expect(page.locator('[data-testid="login-subtitle"]')).toBeVisible();
  });

  test('login page is accessible via navbar link', async ({ page }) => {
    await page.goto('/');

    // Click the "Se connecter" link in the navbar
    await page.locator('[data-testid="nav-login-link"]').click();

    // Should navigate to /login
    await page.waitForURL('**/login');
    await expect(page.locator('[data-testid="login-form"]')).toBeVisible();
  });

  test('login form displays all required fields', async ({ page }) => {
    await page.goto('/login');

    // Email and password fields are present
    await expect(page.locator('[data-testid="login-email-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="login-password-input"]')).toBeVisible();

    // Submit button is present
    await expect(page.locator('[data-testid="login-submit-btn"]')).toBeVisible();

    // Register link is present
    await expect(page.locator('[data-testid="register-link"]')).toBeVisible();
  });

  test('register link on login page navigates to /register', async ({ page }) => {
    await page.goto('/login');

    await page.locator('[data-testid="register-link"]').click();

    await page.waitForURL('**/register');
    await expect(page.locator('[data-testid="register-form"]')).toBeVisible();
  });
});

// ===========================================================================
// AC1 — HAPPY PATH: Login with valid credentials
// ===========================================================================

test.describe('Story 1.2 — AC1: Successful login', () => {
  test('login with valid credentials → token issued, redirected to homepage', async ({
    page,
  }) => {
    // Pre-condition: e2e@test.com exists (from E2E seeder)
    await page.goto('/login');

    // Fill in valid credentials
    await page.locator('[data-testid="login-email-input"]').fill('e2e@test.com');
    await page.locator('[data-testid="login-password-input"]').fill('password');

    // Submit form
    await page.locator('[data-testid="login-submit-btn"]').click();

    // === VÉRIFICATION UI ===
    // User should be redirected away from /login (to homepage)
    await page.waitForURL((url) => !url.pathname.includes('/login'), {
      timeout: 10_000,
    });

    // Should land on homepage (/)
    expect(page.url()).toMatch(/\/$/);

    // === VÉRIFICATION: token stored in localStorage ===
    const token = await page.evaluate(() => localStorage.getItem('token'));
    expect(token).toBeTruthy();
    expect(typeof token).toBe('string');
    expect(token!.length).toBeGreaterThan(0);

    // === VÉRIFICATION DB ===
    // User exists
    const user = await db.findOne('users', { email: 'e2e@test.com' });
    expect(user).toBeTruthy();

    // A non-revoked Passport access token was created for this user
    const tokens = await db.query(
      'SELECT * FROM oauth_access_tokens WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
      [user!.id]
    );
    expect(tokens.length).toBeGreaterThan(0);
    expect(tokens[0].revoked).toBe(0);
  });

  test('auth token has an expiration period (AC1)', async ({ page }) => {
    // Pre-condition: e2e@test.com exists (from E2E seeder)
    await page.goto('/login');

    await page.locator('[data-testid="login-email-input"]').fill('e2e@test.com');
    await page.locator('[data-testid="login-password-input"]').fill('password');
    await page.locator('[data-testid="login-submit-btn"]').click();

    // Wait for redirect
    await page.waitForURL((url) => !url.pathname.includes('/login'), {
      timeout: 10_000,
    });

    // === VÉRIFICATION DB ===
    const user = await db.findOne('users', { email: 'e2e@test.com' });
    expect(user).toBeTruthy();

    // The Passport token should have an expires_at set (not NULL)
    const tokens = await db.query(
      'SELECT * FROM oauth_access_tokens WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
      [user!.id]
    );
    expect(tokens.length).toBeGreaterThan(0);
    expect(tokens[0].expires_at).not.toBeNull();

    // Expiry should be in the future
    const expiresAt = new Date(tokens[0].expires_at);
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  test('after login, navbar shows user info and logout button', async ({ page }) => {
    // Pre-condition: e2e@test.com exists (from E2E seeder)
    await page.goto('/login');

    await page.locator('[data-testid="login-email-input"]').fill('e2e@test.com');
    await page.locator('[data-testid="login-password-input"]').fill('password');
    await page.locator('[data-testid="login-submit-btn"]').click();

    // Wait for redirect to homepage
    await page.waitForURL((url) => !url.pathname.includes('/login'), {
      timeout: 10_000,
    });

    // === VÉRIFICATION UI ===
    // Navbar should show user email and logout button
    await expect(page.locator('[data-testid="nav-user-email"]')).toBeVisible();
    await expect(page.locator('[data-testid="nav-user-email"]')).toContainText('e2e@test.com');
    await expect(page.locator('[data-testid="nav-logout-btn"]')).toBeVisible();

    // Login and register links should NOT be visible
    await expect(page.locator('[data-testid="nav-login-link"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="nav-register-link"]')).not.toBeVisible();
  });
});

// ===========================================================================
// AC1 — LOADING STATE
// ===========================================================================

test.describe('Story 1.2 — Loading state during login', () => {
  test('submit button shows loading spinner during API call', async ({ page }) => {
    await page.goto('/login');

    await page.locator('[data-testid="login-email-input"]').fill('e2e@test.com');
    await page.locator('[data-testid="login-password-input"]').fill('password');

    // Submit the form
    await page.locator('[data-testid="login-submit-btn"]').click();

    // === VÉRIFICATION UI ===
    // During submission, the loading spinner should appear
    const spinner = page.locator('[data-testid="login-loading-spinner"]');
    await expect(spinner).toBeVisible({ timeout: 3_000 });

    // The submit button should be disabled during loading
    await expect(page.locator('[data-testid="login-submit-btn"]')).toBeDisabled();
  });
});

// ===========================================================================
// AC2 — INVALID CREDENTIALS
// ===========================================================================

test.describe('Story 1.2 — AC2: Invalid credentials', () => {
  test('wrong email and password shows generic error message', async ({ page }) => {
    await page.goto('/login');

    await page.locator('[data-testid="login-email-input"]').fill('wrong@example.com');
    await page.locator('[data-testid="login-password-input"]').fill('wrongpassword');
    await page.locator('[data-testid="login-submit-btn"]').click();

    // === VÉRIFICATION UI ===
    // Generic error message should be visible
    const errorMessage = page.locator('[data-testid="login-error-message"]');
    await expect(errorMessage).toBeVisible({ timeout: 5_000 });

    // Error message should be generic — NOT revealing which field is wrong
    // Must NOT mention "email", "mot de passe" specifically
    const errorText = await errorMessage.textContent();
    expect(errorText).toBeTruthy();
    // The message should mention "invalid" or "identifiants" or similar generic term
    expect(errorText).toMatch(/identifiants|invalid|incorrect|invalide/i);
    // Security: Should NOT specifically say "email not found" or "wrong password"
    expect(errorText).not.toMatch(/email.*(introuvable|not found|inconnu)/i);
    expect(errorText).not.toMatch(/(mot de passe|password).*(incorrect|wrong|invalide)/i);

    // Should still be on /login
    expect(page.url()).toContain('/login');

    // === VÉRIFICATION: no token should be stored ===
    const token = await page.evaluate(() => localStorage.getItem('token'));
    expect(token).toBeFalsy();
  });

  test('valid email but wrong password shows same generic error', async ({ page }) => {
    // This test ensures the error message is identical whether email or password is wrong
    // (security: prevents email enumeration)
    await page.goto('/login');

    // e2e@test.com exists, but the password is wrong
    await page.locator('[data-testid="login-email-input"]').fill('e2e@test.com');
    await page.locator('[data-testid="login-password-input"]').fill('definitelywrongpassword');
    await page.locator('[data-testid="login-submit-btn"]').click();

    // === VÉRIFICATION UI ===
    const errorMessage = page.locator('[data-testid="login-error-message"]');
    await expect(errorMessage).toBeVisible({ timeout: 5_000 });

    // Same generic error — no hint that the email was found
    const errorText = await errorMessage.textContent();
    expect(errorText).toMatch(/identifiants|invalid|incorrect|invalide/i);
    // Must NOT say "wrong password" or anything that reveals the email exists
    expect(errorText).not.toMatch(/(mot de passe|password).*(incorrect|wrong)/i);

    // Should still be on /login
    expect(page.url()).toContain('/login');
  });

  test('non-existent email shows same generic error (prevents email enumeration)', async ({
    page,
  }) => {
    await page.goto('/login');

    await page.locator('[data-testid="login-email-input"]').fill('nonexistent-user-xyz@example.com');
    await page.locator('[data-testid="login-password-input"]').fill('SomeP@ssword123');
    await page.locator('[data-testid="login-submit-btn"]').click();

    // === VÉRIFICATION UI ===
    const errorMessage = page.locator('[data-testid="login-error-message"]');
    await expect(errorMessage).toBeVisible({ timeout: 5_000 });

    const errorText = await errorMessage.textContent();
    // Must NOT say "email not found" or "user not found"
    expect(errorText).not.toMatch(/(email|utilisateur|user).*(introuvable|not found|inconnu|nexiste pas)/i);

    expect(page.url()).toContain('/login');
  });
});

// ===========================================================================
// AC2 — CLIENT-SIDE VALIDATION
// ===========================================================================

test.describe('Story 1.2 — Client-side validation', () => {
  test('submitting empty form shows error message', async ({ page }) => {
    await page.goto('/login');

    // Click submit without filling anything
    await page.locator('[data-testid="login-submit-btn"]').click();

    // === VÉRIFICATION UI ===
    const errorMessage = page.locator('[data-testid="login-error-message"]');
    await expect(errorMessage).toBeVisible({ timeout: 5_000 });

    // Should still be on /login
    expect(page.url()).toContain('/login');

    // No token should be stored
    const token = await page.evaluate(() => localStorage.getItem('token'));
    expect(token).toBeFalsy();
  });

  test('submitting with email only shows error', async ({ page }) => {
    await page.goto('/login');

    await page.locator('[data-testid="login-email-input"]').fill('test@example.com');
    // Leave password empty

    await page.locator('[data-testid="login-submit-btn"]').click();

    // === VÉRIFICATION UI ===
    const errorMessage = page.locator('[data-testid="login-error-message"]');
    await expect(errorMessage).toBeVisible({ timeout: 5_000 });

    expect(page.url()).toContain('/login');
  });

  test('submitting with password only shows error', async ({ page }) => {
    await page.goto('/login');

    // Leave email empty
    await page.locator('[data-testid="login-password-input"]').fill('SomePassword123');

    await page.locator('[data-testid="login-submit-btn"]').click();

    // === VÉRIFICATION UI ===
    const errorMessage = page.locator('[data-testid="login-error-message"]');
    await expect(errorMessage).toBeVisible({ timeout: 5_000 });

    expect(page.url()).toContain('/login');
  });
});

// ===========================================================================
// AC3 — LOGOUT
// ===========================================================================

test.describe('Story 1.2 — AC3: Logout', () => {
  test('clicking logout button → token invalidated, redirected to homepage', async ({
    page,
  }) => {
    // === SETUP: login first ===
    await page.goto('/login');
    await page.locator('[data-testid="login-email-input"]').fill('e2e@test.com');
    await page.locator('[data-testid="login-password-input"]').fill('password');
    await page.locator('[data-testid="login-submit-btn"]').click();

    // Wait for login to complete
    await page.waitForURL((url) => !url.pathname.includes('/login'), {
      timeout: 10_000,
    });

    // Verify we are logged in
    await expect(page.locator('[data-testid="nav-logout-btn"]')).toBeVisible();

    // Remember the user ID for DB check
    const user = await db.findOne('users', { email: 'e2e@test.com' });
    expect(user).toBeTruthy();

    // Get the token before logout to verify it gets revoked
    const tokenBefore = await page.evaluate(() => localStorage.getItem('token'));
    expect(tokenBefore).toBeTruthy();

    // === ACTION: click logout ===
    await page.locator('[data-testid="nav-logout-btn"]').click();

    // === VÉRIFICATION UI ===
    // User should be redirected to homepage
    await page.waitForURL((url) => url.pathname === '/' || url.pathname === '', {
      timeout: 10_000,
    });

    // Navbar should show login/register links (unauthenticated state)
    await expect(page.locator('[data-testid="nav-login-link"]')).toBeVisible();
    await expect(page.locator('[data-testid="nav-register-link"]')).toBeVisible();

    // Logout button and user email should NOT be visible
    await expect(page.locator('[data-testid="nav-logout-btn"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="nav-user-email"]')).not.toBeVisible();

    // === VÉRIFICATION: token cleared from localStorage ===
    const tokenAfter = await page.evaluate(() => localStorage.getItem('token'));
    expect(tokenAfter).toBeFalsy();

    // === VÉRIFICATION DB ===
    // The previously active token should be revoked
    const tokens = await db.query(
      'SELECT * FROM oauth_access_tokens WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
      [user!.id]
    );
    expect(tokens.length).toBeGreaterThan(0);
    expect(tokens[0].revoked).toBe(1);
  });

  test('after logout, accessing protected page redirects to login', async ({ page }) => {
    // === SETUP: login via helper ===
    await loginAs(page, 'e2e@test.com', 'password');

    // === ACTION: logout ===
    await logout(page);

    // === VÉRIFICATION UI ===
    // Navigating to a protected page should redirect to /login
    await page.goto('/dashboard');
    await page.waitForURL((url) => url.pathname.includes('/login'), {
      timeout: 10_000,
    });
  });

  test('after logout, navbar shows unauthenticated state on all pages', async ({ page }) => {
    // === SETUP: login via UI ===
    await page.goto('/login');
    await page.locator('[data-testid="login-email-input"]').fill('e2e@test.com');
    await page.locator('[data-testid="login-password-input"]').fill('password');
    await page.locator('[data-testid="login-submit-btn"]').click();

    await page.waitForURL((url) => !url.pathname.includes('/login'), {
      timeout: 10_000,
    });

    // === ACTION: logout ===
    await page.locator('[data-testid="nav-logout-btn"]').click();

    // Wait for redirect to homepage
    await page.waitForURL((url) => url.pathname === '/' || url.pathname === '', {
      timeout: 10_000,
    });

    // === VÉRIFICATION UI ===
    // On homepage: should see login/register, not user info
    await expect(page.locator('[data-testid="nav-login-link"]')).toBeVisible();
    await expect(page.locator('[data-testid="nav-register-link"]')).toBeVisible();
    await expect(page.locator('[data-testid="nav-logout-btn"]')).not.toBeVisible();

    // Navigate to another page — navbar should still be unauthenticated
    await page.locator('[data-testid="nav-about-link"]').click();
    await page.waitForURL('**/about');
    await expect(page.locator('[data-testid="nav-login-link"]')).toBeVisible();
    await expect(page.locator('[data-testid="nav-logout-btn"]')).not.toBeVisible();
  });
});

// ===========================================================================
// SECURITY — No field-specific error reveal
// ===========================================================================

test.describe('Story 1.2 — Security: error message consistency', () => {
  test('error messages for different invalid credential combos are identical', async ({
    page,
  }) => {
    // Test 1: Wrong email + wrong password
    await page.goto('/login');
    await page.locator('[data-testid="login-email-input"]').fill('nonexistent@example.com');
    await page.locator('[data-testid="login-password-input"]').fill('wrongpassword');
    await page.locator('[data-testid="login-submit-btn"]').click();

    const errorMsg1 = page.locator('[data-testid="login-error-message"]');
    await expect(errorMsg1).toBeVisible({ timeout: 5_000 });
    const errorText1 = await errorMsg1.textContent();

    // Test 2: Correct email + wrong password
    await page.goto('/login');
    await page.locator('[data-testid="login-email-input"]').fill('e2e@test.com');
    await page.locator('[data-testid="login-password-input"]').fill('wrongpassword');
    await page.locator('[data-testid="login-submit-btn"]').click();

    const errorMsg2 = page.locator('[data-testid="login-error-message"]');
    await expect(errorMsg2).toBeVisible({ timeout: 5_000 });
    const errorText2 = await errorMsg2.textContent();

    // === VÉRIFICATION: same error message for both cases ===
    // This prevents attackers from enumerating valid emails
    expect(errorText1!.trim()).toBe(errorText2!.trim());
  });
});

// ===========================================================================
// NAVIGATION — Authenticated vs unauthenticated state
// ===========================================================================

test.describe('Story 1.2 — Navigation state', () => {
  test('unauthenticated user sees login and register links in navbar', async ({ page }) => {
    await page.goto('/');

    // Should see login and register links
    await expect(page.locator('[data-testid="nav-login-link"]')).toBeVisible();
    await expect(page.locator('[data-testid="nav-register-link"]')).toBeVisible();

    // Should NOT see logout button or user email
    await expect(page.locator('[data-testid="nav-logout-btn"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="nav-user-email"]')).not.toBeVisible();
  });

  test('authenticated user sees email and logout button in navbar', async ({ page }) => {
    // Login via helper
    await loginAs(page, 'e2e@test.com', 'password');

    await page.goto('/');

    // Should see user email and logout button
    await expect(page.locator('[data-testid="nav-user-email"]')).toBeVisible();
    await expect(page.locator('[data-testid="nav-user-email"]')).toContainText('e2e@test.com');
    await expect(page.locator('[data-testid="nav-logout-btn"]')).toBeVisible();

    // Should NOT see login/register links
    await expect(page.locator('[data-testid="nav-login-link"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="nav-register-link"]')).not.toBeVisible();
  });
});
