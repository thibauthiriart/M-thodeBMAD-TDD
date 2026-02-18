import { test, expect } from '@playwright/test';
import { loginAs, logout } from '../helpers/auth';
import { db } from '../helpers/database';

test.describe('Authentication flow', () => {
  test.afterAll(async () => {
    await db.cleanup();
  });

  test('login via UI with valid credentials', async ({ page }) => {
    // === ACTION UI ===
    await page.goto('/login');

    await page.fill('input[name="email"]', 'e2e@test.com');
    await page.fill('input[name="password"]', 'password');
    await page.click('button[type="submit"]');

    // === VÉRIFICATION UI ===
    // After login, user should be redirected away from /login
    await page.waitForURL((url) => !url.pathname.includes('/login'), {
      timeout: 10_000,
    });

    // === VÉRIFICATION DB ===
    const user = await db.findOne('users', { email: 'e2e@test.com' });
    expect(user).toBeTruthy();
    expect(user!.email_verified_at).not.toBeNull();

    // Verify a Passport token was created for this user
    const tokens = await db.query(
      'SELECT * FROM oauth_access_tokens WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
      [user!.id]
    );
    expect(tokens.length).toBeGreaterThan(0);
    expect(tokens[0].revoked).toBe(0);
  });

  test('login via UI with invalid credentials shows error', async ({ page }) => {
    // === ACTION UI ===
    await page.goto('/login');

    await page.fill('input[name="email"]', 'wrong@example.com');
    await page.fill('input[name="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');

    // === VÉRIFICATION UI ===
    const errorMessage = page.locator('[data-testid="error-message"]');
    await expect(errorMessage).toBeVisible({ timeout: 5_000 });

    // Should still be on the login page
    expect(page.url()).toContain('/login');
  });

  test('loginAs helper authenticates correctly', async ({ page }) => {
    // === ACTION (API-based login) ===
    const { userId, entrepriseId, token } = await loginAs(
      page,
      'e2e@test.com',
      'password'
    );

    // === VÉRIFICATION ===
    expect(userId).toBeGreaterThan(0);
    expect(entrepriseId).toBeGreaterThan(0);
    expect(token).toBeTruthy();

    // The page should be authenticated — not redirected to /login
    await page.goto('/dashboard');
    await page.waitForURL((url) => !url.pathname.includes('/login'), {
      timeout: 10_000,
    });

    // === VÉRIFICATION DB ===
    const user = await db.findOne('users', { id: userId });
    expect(user).toBeTruthy();
    expect(user!.email).toBe('e2e@test.com');

    // Verify user-entreprise relationship exists
    const pivot = await db.findOne('entreprise_user', {
      user_id: userId,
      entreprise_id: entrepriseId,
    });
    expect(pivot).toBeTruthy();
  });

  test('logout clears session', async ({ page }) => {
    // === SETUP ===
    await loginAs(page, 'e2e@test.com', 'password');

    // === ACTION ===
    await logout(page);

    // === VÉRIFICATION UI ===
    // After logout + reload, navigating to a protected page should redirect to /login
    await page.goto('/dashboard');
    await page.waitForURL((url) => url.pathname.includes('/login'), {
      timeout: 10_000,
    });
  });
});
