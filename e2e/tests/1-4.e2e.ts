import { test, expect, Page } from '@playwright/test';
import { loginAs, logout } from '../helpers/auth';
import { db } from '../helpers/database';

/**
 * Story 1.4 — Role-Based Access Control
 *
 * AC1: User with role "acheteur" → cannot access seller dashboard or admin dashboard
 *      → redirected to /unauthorized with message
 * AC2: User with role "vendeur" → cannot access admin dashboard
 *      → redirected to /unauthorized with message
 * AC3: Visitor (not logged in) → cannot access protected routes
 *      → redirected to /login
 *
 * Pre-conditions:
 * - e2e@test.com / password exists with role "acheteur" (from E2E seeder)
 * - For vendeur/admin tests, users are created via registration or seeding
 *
 * The tests describe EXPECTED behavior (TDD). They will fail until:
 * - Backend role middleware is implemented
 * - Backend route groups with role middleware are set up
 * - Frontend route guards check roles properly
 * - Users with vendeur and admin roles exist in the DB
 */

// ---------------------------------------------------------------------------
// Test user credentials — these users need to exist in the DB
// The acheteur user exists from E2ETestSeeder.
// Vendeur and admin users will be created via the API in beforeAll hooks
// or need to be seeded. For TDD, we assume they will exist.
// ---------------------------------------------------------------------------
const ACHETEUR_EMAIL = 'e2e@test.com';
const ACHETEUR_PASSWORD = 'password';

// These users will need to be created by the seeder or a setup hook
const VENDEUR_EMAIL = 'e2e-vendeur@test.com';
const VENDEUR_PASSWORD = 'password';

const ADMIN_EMAIL = 'e2e-admin@test.com';
const ADMIN_PASSWORD = 'password';

// ---------------------------------------------------------------------------
// Helper: register a user with a specific role via API (for test setup)
// ---------------------------------------------------------------------------
async function ensureUserWithRole(
  page: Page,
  email: string,
  password: string,
  role: 'acheteur' | 'vendeur' | 'admin'
): Promise<void> {
  // Check if user already exists in DB
  const existing = await db.findOne('users', { email });
  if (existing) return;

  // Register via API
  const API_URL = process.env.API_URL || 'http://localhost:8080/api';
  const response = await page.request.post(`${API_URL}/auth/register`, {
    data: {
      email,
      password,
      password_confirmation: password,
      role,
      name: `E2E ${role} User`,
    },
  });

  // If registration fails (e.g. admin role not yet supported), we still want
  // the test to clearly show WHY it fails — not crash in setup
  if (!response.ok()) {
    console.warn(
      `[SETUP] Could not create ${role} user (${email}): ${response.status()} — ` +
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
    // Ensure vendeur and admin test users exist
    await ensureUserWithRole(page, VENDEUR_EMAIL, VENDEUR_PASSWORD, 'vendeur');
    await ensureUserWithRole(page, ADMIN_EMAIL, ADMIN_PASSWORD, 'admin');
  } finally {
    await page.close();
  }
});

test.afterAll(async () => {
  // Cleanup test users created for RBAC testing (vendeur, admin)
  // Keep e2e@test.com (managed by the E2ETestSeeder)
  await db.query('DELETE FROM users WHERE email IN (?, ?)', [
    VENDEUR_EMAIL,
    ADMIN_EMAIL,
  ]);
  await db.cleanup();
});

// ===========================================================================
// AC3 — VISITOR (NOT LOGGED IN): Redirected to /login for all protected routes
// ===========================================================================

test.describe('Story 1.4 — AC3: Visitor redirected to /login on protected routes', () => {
  test('visitor accessing /dashboard is redirected to /login', async ({ page }) => {
    // === ACTION: navigate to protected route without login ===
    await page.goto('/dashboard');

    // === VÉRIFICATION UI ===
    await page.waitForURL((url) => url.pathname.includes('/login'), {
      timeout: 10_000,
    });
    const currentUrl = page.url();
    expect(currentUrl).toContain('/login');

    // Dashboard content should NOT be visible
    await expect(page.locator('[data-testid="dashboard-title"]')).not.toBeVisible();
  });

  test('visitor accessing /profile is redirected to /login', async ({ page }) => {
    // === ACTION ===
    await page.goto('/profile');

    // === VÉRIFICATION UI ===
    await page.waitForURL((url) => url.pathname.includes('/login'), {
      timeout: 10_000,
    });
    const currentUrl = page.url();
    expect(currentUrl).toContain('/login');
  });

  test('visitor accessing /seller/dashboard is redirected to /login', async ({ page }) => {
    // === ACTION ===
    await page.goto('/seller/dashboard');

    // === VÉRIFICATION UI ===
    await page.waitForURL((url) => url.pathname.includes('/login'), {
      timeout: 10_000,
    });
    const currentUrl = page.url();
    expect(currentUrl).toContain('/login');

    // Seller dashboard content should NOT be visible
    await expect(page.locator('[data-testid="seller-dashboard-title"]')).not.toBeVisible();
  });

  test('visitor accessing /admin/dashboard is redirected to /login', async ({ page }) => {
    // === ACTION ===
    await page.goto('/admin/dashboard');

    // === VÉRIFICATION UI ===
    await page.waitForURL((url) => url.pathname.includes('/login'), {
      timeout: 10_000,
    });
    const currentUrl = page.url();
    expect(currentUrl).toContain('/login');

    // Admin dashboard content should NOT be visible
    await expect(page.locator('[data-testid="admin-dashboard-title"]')).not.toBeVisible();
  });

  test('visitor sees login and register links in navbar, NOT dashboard/profile/logout', async ({
    page,
  }) => {
    // === ACTION ===
    await page.goto('/');

    // === VÉRIFICATION UI ===
    // Login/register links visible
    await expect(page.locator('[data-testid="nav-login-link"]')).toBeVisible();
    await expect(page.locator('[data-testid="nav-register-link"]')).toBeVisible();

    // Authenticated links NOT visible
    await expect(page.locator('[data-testid="nav-dashboard-link"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="nav-profile-link"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="nav-logout-btn"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="nav-seller-dashboard-link"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="nav-admin-dashboard-link"]')).not.toBeVisible();
  });
});

// ===========================================================================
// AC1 — ACHETEUR: Cannot access seller dashboard or admin dashboard
// ===========================================================================

test.describe('Story 1.4 — AC1: Acheteur blocked from seller/admin routes', () => {
  test('acheteur accessing /seller/dashboard is redirected to /unauthorized', async ({
    page,
  }) => {
    // === SETUP: login as acheteur ===
    await loginAs(page, ACHETEUR_EMAIL, ACHETEUR_PASSWORD);

    // === ACTION: navigate to seller dashboard ===
    await page.goto('/seller/dashboard');

    // === VÉRIFICATION UI ===
    // Should be redirected to /unauthorized
    await page.waitForURL((url) => url.pathname.includes('/unauthorized'), {
      timeout: 10_000,
    });

    // Unauthorized page elements should be visible
    await expect(page.locator('[data-testid="unauthorized-title"]')).toBeVisible();
    await expect(page.locator('[data-testid="unauthorized-title"]')).toHaveText('Accès refusé');

    // Error message should explain the restriction
    await expect(page.locator('[data-testid="unauthorized-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="unauthorized-message"]')).toContainText(
      /droits|autorisé|accès|permission/i
    );

    // Seller dashboard content should NOT be visible
    await expect(page.locator('[data-testid="seller-dashboard-title"]')).not.toBeVisible();
  });

  test('acheteur accessing /admin/dashboard is redirected to /unauthorized', async ({
    page,
  }) => {
    // === SETUP: login as acheteur ===
    await loginAs(page, ACHETEUR_EMAIL, ACHETEUR_PASSWORD);

    // === ACTION: navigate to admin dashboard ===
    await page.goto('/admin/dashboard');

    // === VÉRIFICATION UI ===
    // Should be redirected to /unauthorized
    await page.waitForURL((url) => url.pathname.includes('/unauthorized'), {
      timeout: 10_000,
    });

    // Unauthorized page should be visible
    await expect(page.locator('[data-testid="unauthorized-title"]')).toBeVisible();
    await expect(page.locator('[data-testid="unauthorized-title"]')).toHaveText('Accès refusé');
    await expect(page.locator('[data-testid="unauthorized-message"]')).toBeVisible();

    // Admin dashboard content should NOT be visible
    await expect(page.locator('[data-testid="admin-dashboard-title"]')).not.toBeVisible();
  });

  test('acheteur CAN access /dashboard (general authenticated route)', async ({ page }) => {
    // === SETUP: login as acheteur ===
    await loginAs(page, ACHETEUR_EMAIL, ACHETEUR_PASSWORD);

    // === ACTION: navigate to dashboard ===
    await page.goto('/dashboard');

    // === VÉRIFICATION UI ===
    // Should NOT be redirected — should stay on dashboard
    await page.waitForURL('**/dashboard');
    await expect(page.locator('[data-testid="dashboard-title"]')).toBeVisible();
    await expect(page.locator('[data-testid="dashboard-title"]')).toHaveText('Dashboard');
  });

  test('acheteur CAN access /profile (general authenticated route)', async ({ page }) => {
    // === SETUP: login as acheteur ===
    await loginAs(page, ACHETEUR_EMAIL, ACHETEUR_PASSWORD);

    // === ACTION: navigate to profile ===
    await page.goto('/profile');

    // === VÉRIFICATION UI ===
    await page.waitForURL('**/profile');
    await expect(page.locator('[data-testid="profile-title"]')).toBeVisible();
  });

  test('acheteur does NOT see seller or admin links in navbar', async ({ page }) => {
    // === SETUP: login as acheteur ===
    await loginAs(page, ACHETEUR_EMAIL, ACHETEUR_PASSWORD);
    await page.goto('/');

    // === VÉRIFICATION UI ===
    // General auth links visible
    await expect(page.locator('[data-testid="nav-dashboard-link"]')).toBeVisible();
    await expect(page.locator('[data-testid="nav-profile-link"]')).toBeVisible();
    await expect(page.locator('[data-testid="nav-logout-btn"]')).toBeVisible();

    // Role-specific links NOT visible for acheteur
    await expect(page.locator('[data-testid="nav-seller-dashboard-link"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="nav-admin-dashboard-link"]')).not.toBeVisible();
  });

  test('acheteur sees role badge "Acheteur" in navbar', async ({ page }) => {
    // === SETUP ===
    await loginAs(page, ACHETEUR_EMAIL, ACHETEUR_PASSWORD);
    await page.goto('/');

    // === VÉRIFICATION UI ===
    const roleBadge = page.locator('[data-testid="nav-user-role-badge"]');
    await expect(roleBadge).toBeVisible();
    await expect(roleBadge).toContainText(/acheteur/i);
  });

  test('acheteur dashboard shows role badge and NO seller/admin shortcuts', async ({ page }) => {
    // === SETUP ===
    await loginAs(page, ACHETEUR_EMAIL, ACHETEUR_PASSWORD);
    await page.goto('/dashboard');

    // === VÉRIFICATION UI ===
    await expect(page.locator('[data-testid="dashboard-user-role"]')).toBeVisible();
    await expect(page.locator('[data-testid="dashboard-user-role"]')).toContainText(/acheteur/i);

    // Acheteur should NOT see seller or admin shortcuts
    await expect(page.locator('[data-testid="dashboard-seller-shortcut"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="dashboard-admin-shortcut"]')).not.toBeVisible();
  });

  test('acheteur on /unauthorized page can navigate back to dashboard', async ({ page }) => {
    // === SETUP: login as acheteur, go to forbidden route ===
    await loginAs(page, ACHETEUR_EMAIL, ACHETEUR_PASSWORD);
    await page.goto('/seller/dashboard');

    // Wait for redirect to /unauthorized
    await page.waitForURL((url) => url.pathname.includes('/unauthorized'), {
      timeout: 10_000,
    });

    // === ACTION: click "Aller au dashboard" link ===
    await page.locator('[data-testid="unauthorized-dashboard-link"]').click();

    // === VÉRIFICATION UI ===
    await page.waitForURL('**/dashboard');
    await expect(page.locator('[data-testid="dashboard-title"]')).toBeVisible();
  });

  test('acheteur on /unauthorized page can navigate back to home', async ({ page }) => {
    // === SETUP: login as acheteur, go to forbidden route ===
    await loginAs(page, ACHETEUR_EMAIL, ACHETEUR_PASSWORD);
    await page.goto('/admin/dashboard');

    // Wait for redirect to /unauthorized
    await page.waitForURL((url) => url.pathname.includes('/unauthorized'), {
      timeout: 10_000,
    });

    // === ACTION: click "Retour à l'accueil" link ===
    await page.locator('[data-testid="unauthorized-home-link"]').click();

    // === VÉRIFICATION UI ===
    await page.waitForURL((url) => url.pathname === '/');
  });
});

// ===========================================================================
// AC2 — VENDEUR: Cannot access admin dashboard, CAN access seller dashboard
// ===========================================================================

test.describe('Story 1.4 — AC2: Vendeur blocked from admin route, allowed on seller route', () => {
  test('vendeur accessing /admin/dashboard is redirected to /unauthorized', async ({ page }) => {
    // === SETUP: login as vendeur ===
    await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);

    // === ACTION: navigate to admin dashboard ===
    await page.goto('/admin/dashboard');

    // === VÉRIFICATION UI ===
    await page.waitForURL((url) => url.pathname.includes('/unauthorized'), {
      timeout: 10_000,
    });

    // Unauthorized page visible
    await expect(page.locator('[data-testid="unauthorized-title"]')).toBeVisible();
    await expect(page.locator('[data-testid="unauthorized-title"]')).toHaveText('Accès refusé');
    await expect(page.locator('[data-testid="unauthorized-message"]')).toBeVisible();

    // Admin dashboard content should NOT be visible
    await expect(page.locator('[data-testid="admin-dashboard-title"]')).not.toBeVisible();
  });

  test('vendeur CAN access /seller/dashboard', async ({ page }) => {
    // === SETUP: login as vendeur ===
    await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);

    // === ACTION: navigate to seller dashboard ===
    await page.goto('/seller/dashboard');

    // === VÉRIFICATION UI ===
    await page.waitForURL('**/seller/dashboard');
    await expect(page.locator('[data-testid="seller-dashboard-title"]')).toBeVisible();
    await expect(page.locator('[data-testid="seller-dashboard-title"]')).toHaveText(
      'Tableau de bord vendeur'
    );

    // Seller dashboard content is visible
    await expect(page.locator('[data-testid="seller-stats"]')).toBeVisible();
    await expect(page.locator('[data-testid="seller-products-table"]')).toBeVisible();
  });

  test('vendeur CAN access /dashboard (general authenticated route)', async ({ page }) => {
    // === SETUP: login as vendeur ===
    await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);

    // === ACTION ===
    await page.goto('/dashboard');

    // === VÉRIFICATION UI ===
    await page.waitForURL('**/dashboard');
    await expect(page.locator('[data-testid="dashboard-title"]')).toBeVisible();
  });

  test('vendeur CAN access /profile (general authenticated route)', async ({ page }) => {
    // === SETUP: login as vendeur ===
    await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);

    // === ACTION ===
    await page.goto('/profile');

    // === VÉRIFICATION UI ===
    await page.waitForURL('**/profile');
    await expect(page.locator('[data-testid="profile-title"]')).toBeVisible();
  });

  test('vendeur sees "Espace vendeur" link in navbar, NOT "Administration"', async ({ page }) => {
    // === SETUP: login as vendeur ===
    await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);
    await page.goto('/');

    // === VÉRIFICATION UI ===
    // Vendeur-specific link visible
    await expect(page.locator('[data-testid="nav-seller-dashboard-link"]')).toBeVisible();
    await expect(page.locator('[data-testid="nav-seller-dashboard-link"]')).toContainText(
      /espace vendeur/i
    );

    // Admin link NOT visible
    await expect(page.locator('[data-testid="nav-admin-dashboard-link"]')).not.toBeVisible();

    // General auth links visible
    await expect(page.locator('[data-testid="nav-dashboard-link"]')).toBeVisible();
    await expect(page.locator('[data-testid="nav-profile-link"]')).toBeVisible();
    await expect(page.locator('[data-testid="nav-logout-btn"]')).toBeVisible();
  });

  test('vendeur sees role badge "Vendeur" in navbar', async ({ page }) => {
    // === SETUP ===
    await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);
    await page.goto('/');

    // === VÉRIFICATION UI ===
    const roleBadge = page.locator('[data-testid="nav-user-role-badge"]');
    await expect(roleBadge).toBeVisible();
    await expect(roleBadge).toContainText(/vendeur/i);
  });

  test('vendeur dashboard shows seller shortcut but NOT admin shortcut', async ({ page }) => {
    // === SETUP ===
    await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);
    await page.goto('/dashboard');

    // === VÉRIFICATION UI ===
    // Seller shortcut visible
    await expect(page.locator('[data-testid="dashboard-role-shortcuts"]')).toBeVisible();
    await expect(page.locator('[data-testid="dashboard-seller-shortcut"]')).toBeVisible();

    // Admin shortcut NOT visible
    await expect(page.locator('[data-testid="dashboard-admin-shortcut"]')).not.toBeVisible();
  });

  test('vendeur clicking "Espace vendeur" navbar link navigates to /seller/dashboard', async ({
    page,
  }) => {
    // === SETUP ===
    await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);
    await page.goto('/');

    // === ACTION ===
    await page.locator('[data-testid="nav-seller-dashboard-link"]').click();

    // === VÉRIFICATION UI ===
    await page.waitForURL('**/seller/dashboard');
    await expect(page.locator('[data-testid="seller-dashboard-title"]')).toBeVisible();
  });

  test('vendeur seller dashboard shows stats and products', async ({ page }) => {
    // === SETUP ===
    await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);
    await page.goto('/seller/dashboard');

    // === VÉRIFICATION UI ===
    // Stats cards
    await expect(page.locator('[data-testid="seller-stat-products"]')).toBeVisible();
    await expect(page.locator('[data-testid="seller-stat-orders"]')).toBeVisible();
    await expect(page.locator('[data-testid="seller-stat-revenue"]')).toBeVisible();

    // Add product button
    await expect(page.locator('[data-testid="seller-add-product-btn"]')).toBeVisible();

    // Products table
    await expect(page.locator('[data-testid="seller-products-table"]')).toBeVisible();
  });
});

// ===========================================================================
// ADMIN: Can access all dashboards
// ===========================================================================

test.describe('Story 1.4 — Admin: Full access to all routes', () => {
  test('admin CAN access /admin/dashboard', async ({ page }) => {
    // === SETUP: login as admin ===
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);

    // === ACTION ===
    await page.goto('/admin/dashboard');

    // === VÉRIFICATION UI ===
    await page.waitForURL('**/admin/dashboard');
    await expect(page.locator('[data-testid="admin-dashboard-title"]')).toBeVisible();
    await expect(page.locator('[data-testid="admin-dashboard-title"]')).toHaveText(
      'Administration'
    );
  });

  test('admin CAN access /dashboard (general authenticated route)', async ({ page }) => {
    // === SETUP ===
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);

    // === ACTION ===
    await page.goto('/dashboard');

    // === VÉRIFICATION UI ===
    await page.waitForURL('**/dashboard');
    await expect(page.locator('[data-testid="dashboard-title"]')).toBeVisible();
  });

  test('admin CAN access /profile (general authenticated route)', async ({ page }) => {
    // === SETUP ===
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);

    // === ACTION ===
    await page.goto('/profile');

    // === VÉRIFICATION UI ===
    await page.waitForURL('**/profile');
    await expect(page.locator('[data-testid="profile-title"]')).toBeVisible();
  });

  test('admin sees "Administration" link in navbar', async ({ page }) => {
    // === SETUP ===
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.goto('/');

    // === VÉRIFICATION UI ===
    await expect(page.locator('[data-testid="nav-admin-dashboard-link"]')).toBeVisible();
    await expect(page.locator('[data-testid="nav-admin-dashboard-link"]')).toContainText(
      /administration/i
    );

    // General auth links visible
    await expect(page.locator('[data-testid="nav-dashboard-link"]')).toBeVisible();
    await expect(page.locator('[data-testid="nav-profile-link"]')).toBeVisible();
    await expect(page.locator('[data-testid="nav-logout-btn"]')).toBeVisible();
  });

  test('admin sees role badge "Admin" in navbar', async ({ page }) => {
    // === SETUP ===
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.goto('/');

    // === VÉRIFICATION UI ===
    const roleBadge = page.locator('[data-testid="nav-user-role-badge"]');
    await expect(roleBadge).toBeVisible();
    await expect(roleBadge).toContainText(/admin/i);
  });

  test('admin dashboard shows admin shortcut', async ({ page }) => {
    // === SETUP ===
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.goto('/dashboard');

    // === VÉRIFICATION UI ===
    await expect(page.locator('[data-testid="dashboard-role-shortcuts"]')).toBeVisible();
    await expect(page.locator('[data-testid="dashboard-admin-shortcut"]')).toBeVisible();
  });

  test('admin clicking "Administration" navbar link navigates to /admin/dashboard', async ({
    page,
  }) => {
    // === SETUP ===
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.goto('/');

    // === ACTION ===
    await page.locator('[data-testid="nav-admin-dashboard-link"]').click();

    // === VÉRIFICATION UI ===
    await page.waitForURL('**/admin/dashboard');
    await expect(page.locator('[data-testid="admin-dashboard-title"]')).toBeVisible();
  });

  test('admin dashboard shows users tab by default with users table', async ({ page }) => {
    // === SETUP ===
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.goto('/admin/dashboard');

    // === VÉRIFICATION UI ===
    // Tabs visible
    await expect(page.locator('[data-testid="admin-tabs"]')).toBeVisible();
    await expect(page.locator('[data-testid="admin-tab-users"]')).toBeVisible();
    await expect(page.locator('[data-testid="admin-tab-stats"]')).toBeVisible();

    // Users table visible by default
    await expect(page.locator('[data-testid="admin-users-table"]')).toBeVisible();
  });

  test('admin dashboard stats tab shows all statistics', async ({ page }) => {
    // === SETUP ===
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.goto('/admin/dashboard');

    // === ACTION: switch to stats tab ===
    await page.locator('[data-testid="admin-tab-stats"]').click();

    // === VÉRIFICATION UI ===
    await expect(page.locator('[data-testid="admin-stats-panel"]')).toBeVisible();
    await expect(page.locator('[data-testid="admin-stat-total-users"]')).toBeVisible();
    await expect(page.locator('[data-testid="admin-stat-sellers"]')).toBeVisible();
    await expect(page.locator('[data-testid="admin-stat-buyers"]')).toBeVisible();
    await expect(page.locator('[data-testid="admin-stat-admins"]')).toBeVisible();
  });
});

// ===========================================================================
// UNAUTHORIZED PAGE — Structure & Content
// ===========================================================================

test.describe('Story 1.4 — Unauthorized page structure', () => {
  test('unauthorized page displays correct title and message', async ({ page }) => {
    // === SETUP: login as acheteur, access forbidden route ===
    await loginAs(page, ACHETEUR_EMAIL, ACHETEUR_PASSWORD);
    await page.goto('/seller/dashboard');

    // === VÉRIFICATION UI ===
    await page.waitForURL((url) => url.pathname.includes('/unauthorized'), {
      timeout: 10_000,
    });

    // Title "Accès refusé"
    await expect(page.locator('[data-testid="unauthorized-title"]')).toBeVisible();
    await expect(page.locator('[data-testid="unauthorized-title"]')).toHaveText('Accès refusé');

    // Message with explanation
    await expect(page.locator('[data-testid="unauthorized-message"]')).toBeVisible();
    const messageText = await page.locator('[data-testid="unauthorized-message"]').textContent();
    expect(messageText!.length).toBeGreaterThan(0);

    // Navigation links
    await expect(page.locator('[data-testid="unauthorized-home-link"]')).toBeVisible();
    await expect(page.locator('[data-testid="unauthorized-dashboard-link"]')).toBeVisible();
  });

  test('unauthorized page is accessible directly via /unauthorized URL', async ({ page }) => {
    // === ACTION: navigate directly ===
    await page.goto('/unauthorized');

    // === VÉRIFICATION UI ===
    await expect(page.locator('[data-testid="unauthorized-title"]')).toBeVisible();
    await expect(page.locator('[data-testid="unauthorized-title"]')).toHaveText('Accès refusé');
  });

  test('unauthorized page displays custom message from query parameter', async ({ page }) => {
    // === ACTION: navigate with custom message ===
    const customMessage = 'Accès interdit pour votre rôle';
    await page.goto(`/unauthorized?message=${encodeURIComponent(customMessage)}`);

    // === VÉRIFICATION UI ===
    await expect(page.locator('[data-testid="unauthorized-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="unauthorized-message"]')).toHaveText(customMessage);
  });

  test('unauthorized page shows default message when no query param provided', async ({
    page,
  }) => {
    // === ACTION: navigate without message query ===
    await page.goto('/unauthorized');

    // === VÉRIFICATION UI ===
    await expect(page.locator('[data-testid="unauthorized-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="unauthorized-message"]')).toContainText(
      /droits|accéder|page/i
    );
  });
});

// ===========================================================================
// SESSION EXPIRY & LOGOUT — Role-based access revoked after logout
// ===========================================================================

test.describe('Story 1.4 — Logout clears role-based access', () => {
  test('after vendeur logout, accessing /seller/dashboard redirects to /login', async ({
    page,
  }) => {
    // === SETUP: login as vendeur then logout ===
    await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);
    await logout(page);

    // === ACTION: try to access seller dashboard ===
    await page.goto('/seller/dashboard');

    // === VÉRIFICATION UI ===
    await page.waitForURL((url) => url.pathname.includes('/login'), {
      timeout: 10_000,
    });
  });

  test('after admin logout, accessing /admin/dashboard redirects to /login', async ({ page }) => {
    // === SETUP: login as admin then logout ===
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await logout(page);

    // === ACTION: try to access admin dashboard ===
    await page.goto('/admin/dashboard');

    // === VÉRIFICATION UI ===
    await page.waitForURL((url) => url.pathname.includes('/login'), {
      timeout: 10_000,
    });
  });

  test('after logout, navbar role badge is not visible', async ({ page }) => {
    // === SETUP: login then logout ===
    await loginAs(page, ACHETEUR_EMAIL, ACHETEUR_PASSWORD);

    // Verify role badge visible while logged in
    await page.goto('/');
    await expect(page.locator('[data-testid="nav-user-role-badge"]')).toBeVisible();

    // Logout
    await logout(page);

    // === VÉRIFICATION UI ===
    await page.goto('/');
    await expect(page.locator('[data-testid="nav-user-role-badge"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="nav-login-link"]')).toBeVisible();
  });
});

// ===========================================================================
// DB VERIFICATION — Role assignments are correct
// ===========================================================================

test.describe('Story 1.4 — DB verification: user roles', () => {
  test('acheteur user has role "acheteur" in database', async ({ page }) => {
    // === VÉRIFICATION DB ===
    const user = await db.findOne('users', { email: ACHETEUR_EMAIL });
    expect(user).toBeTruthy();
    expect(user!.role).toBe('acheteur');
  });

  test('vendeur user has role "vendeur" in database', async ({ page }) => {
    // === VÉRIFICATION DB ===
    const user = await db.findOne('users', { email: VENDEUR_EMAIL });
    expect(user).toBeTruthy();
    expect(user!.role).toBe('vendeur');
  });

  test('admin user has role "admin" in database', async ({ page }) => {
    // === VÉRIFICATION DB ===
    const user = await db.findOne('users', { email: ADMIN_EMAIL });
    expect(user).toBeTruthy();
    expect(user!.role).toBe('admin');
  });
});

// ===========================================================================
// BACKEND API — Role middleware returns 403 for unauthorized access
// ===========================================================================

test.describe('Story 1.4 — Backend API: Role middleware (403 responses)', () => {
  test('API returns 401 for unauthenticated request to seller route', async ({ page }) => {
    // === ACTION: call seller API route without auth ===
    const API_URL = process.env.API_URL || 'http://localhost:8080/api';
    const response = await page.request.get(`${API_URL}/seller/dashboard`, {
      headers: { Accept: 'application/json' },
    });

    // === VÉRIFICATION ===
    // Should return 401 Unauthenticated
    expect(response.status()).toBe(401);
  });

  test('API returns 401 for unauthenticated request to admin route', async ({ page }) => {
    // === ACTION: call admin API route without auth ===
    const API_URL = process.env.API_URL || 'http://localhost:8080/api';
    const response = await page.request.get(`${API_URL}/admin/dashboard`, {
      headers: { Accept: 'application/json' },
    });

    // === VÉRIFICATION ===
    expect(response.status()).toBe(401);
  });

  test('API returns 403 for acheteur accessing seller route', async ({ page }) => {
    // === SETUP: login as acheteur to get token ===
    const { token } = await loginAs(page, ACHETEUR_EMAIL, ACHETEUR_PASSWORD);
    const API_URL = process.env.API_URL || 'http://localhost:8080/api';

    // === ACTION: call seller API route with acheteur token ===
    const response = await page.request.get(`${API_URL}/seller/dashboard`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    // === VÉRIFICATION ===
    // Should return 403 Forbidden (not 401 — user IS authenticated, just not authorized)
    expect(response.status()).toBe(403);
  });

  test('API returns 403 for acheteur accessing admin route', async ({ page }) => {
    // === SETUP: login as acheteur to get token ===
    const { token } = await loginAs(page, ACHETEUR_EMAIL, ACHETEUR_PASSWORD);
    const API_URL = process.env.API_URL || 'http://localhost:8080/api';

    // === ACTION: call admin API route with acheteur token ===
    const response = await page.request.get(`${API_URL}/admin/dashboard`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    // === VÉRIFICATION ===
    expect(response.status()).toBe(403);
  });

  test('API returns 403 for vendeur accessing admin route', async ({ page }) => {
    // === SETUP: login as vendeur to get token ===
    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);
    const API_URL = process.env.API_URL || 'http://localhost:8080/api';

    // === ACTION: call admin API route with vendeur token ===
    const response = await page.request.get(`${API_URL}/admin/dashboard`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    // === VÉRIFICATION ===
    expect(response.status()).toBe(403);
  });

  test('API returns 200 for vendeur accessing seller route', async ({ page }) => {
    // === SETUP: login as vendeur to get token ===
    const { token } = await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);
    const API_URL = process.env.API_URL || 'http://localhost:8080/api';

    // === ACTION: call seller API route with vendeur token ===
    const response = await page.request.get(`${API_URL}/seller/dashboard`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    // === VÉRIFICATION ===
    // Should return 200 OK — vendeur is authorized for seller routes
    expect(response.status()).toBe(200);
  });

  test('API returns 200 for admin accessing admin route', async ({ page }) => {
    // === SETUP: login as admin to get token ===
    const { token } = await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    const API_URL = process.env.API_URL || 'http://localhost:8080/api';

    // === ACTION: call admin API route with admin token ===
    const response = await page.request.get(`${API_URL}/admin/dashboard`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    // === VÉRIFICATION ===
    expect(response.status()).toBe(200);
  });
});

// ===========================================================================
// CROSS-ROLE ISOLATION — Each role only sees their own data
// ===========================================================================

test.describe('Story 1.4 — Cross-role isolation', () => {
  test('acheteur accessing /seller/dashboard does not see seller data', async ({ page }) => {
    // === SETUP: login as acheteur ===
    await loginAs(page, ACHETEUR_EMAIL, ACHETEUR_PASSWORD);

    // === ACTION: try to access seller dashboard ===
    await page.goto('/seller/dashboard');

    // === VÉRIFICATION UI ===
    // Should be on /unauthorized — no seller data leaked
    await page.waitForURL((url) => url.pathname.includes('/unauthorized'), {
      timeout: 10_000,
    });

    // Products table from seller dashboard should NOT be in DOM
    await expect(page.locator('[data-testid="seller-products-table"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="seller-stats"]')).not.toBeVisible();
  });

  test('vendeur accessing /admin/dashboard does not see admin data', async ({ page }) => {
    // === SETUP: login as vendeur ===
    await loginAs(page, VENDEUR_EMAIL, VENDEUR_PASSWORD);

    // === ACTION: try to access admin dashboard ===
    await page.goto('/admin/dashboard');

    // === VÉRIFICATION UI ===
    // Should be on /unauthorized — no admin data leaked
    await page.waitForURL((url) => url.pathname.includes('/unauthorized'), {
      timeout: 10_000,
    });

    // Admin content should NOT be in DOM
    await expect(page.locator('[data-testid="admin-users-table"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="admin-tabs"]')).not.toBeVisible();
  });

  test('acheteur accessing /admin/dashboard does not see admin data', async ({ page }) => {
    // === SETUP: login as acheteur ===
    await loginAs(page, ACHETEUR_EMAIL, ACHETEUR_PASSWORD);

    // === ACTION: try to access admin dashboard ===
    await page.goto('/admin/dashboard');

    // === VÉRIFICATION UI ===
    await page.waitForURL((url) => url.pathname.includes('/unauthorized'), {
      timeout: 10_000,
    });

    // Admin content should NOT be in DOM
    await expect(page.locator('[data-testid="admin-users-table"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="admin-stats-panel"]')).not.toBeVisible();
  });
});
