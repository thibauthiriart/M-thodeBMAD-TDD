import { Page } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const API_URL = process.env.API_URL || 'http://localhost:8080/api';

interface LoginApiResponse {
  data: {
    token: string;
    user: {
      id: number;
      name: string;
      email: string;
    };
    entreprises: Array<{
      id: number;
      nom: string;
      pivot: { role: string };
    }>;
  };
}

/**
 * Login via API and inject the token into the page's localStorage.
 * This avoids the slow UI login flow for every test.
 *
 * Usage:
 *   await loginAs(page, 'e2e@test.com', 'password');
 *   // Page is now authenticated and ready
 */
export async function loginAs(
  page: Page,
  email: string,
  password: string,
  options?: { entrepriseId?: number }
): Promise<{ userId: number; entrepriseId: number; token: string }> {
  // 1. Call login API directly
  const response = await page.request.post(`${API_URL}/auth/login`, {
    data: { email, password },
  });

  if (!response.ok()) {
    const body = await response.text();
    throw new Error(`Login API failed (${response.status()}): ${body}`);
  }

  const json: LoginApiResponse = await response.json();
  const token = json.data.token;
  const userId = json.data.user.id;

  // Pick entreprise: explicit or first available
  const entrepriseId =
    options?.entrepriseId ??
    (json.data.entreprises.length > 0 ? json.data.entreprises[0].id : 0);

  // 2. Navigate to the app first (needed to set localStorage on the right origin)
  await page.goto('/');

  // 3. Inject token and entreprise into localStorage
  await page.evaluate(
    ({ token, entrepriseId }) => {
      localStorage.setItem('token', token);
      if (entrepriseId) {
        localStorage.setItem('activeEntrepriseId', String(entrepriseId));
      }
    },
    { token, entrepriseId }
  );

  // 4. Reload to let the app pick up the token
  await page.reload();

  return { userId, entrepriseId, token };
}

/**
 * Clear auth state from localStorage.
 */
export async function logout(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('activeEntrepriseId');
  });
  await page.reload();
}
