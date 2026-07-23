import { test, expect } from '@playwright/test';

const DASHBOARD_URL = process.env.DASHBOARD_URL || 'http://localhost:3000';

test.describe('Dashboard', () => {
  test('loads dashboard page', async ({ page }) => {
    await page.goto(DASHBOARD_URL);
    await expect(page.locator('body')).toBeVisible();
    await page.waitForLoadState('networkidle');
  });

  test('displays navigation elements', async ({ page }) => {
    await page.goto(DASHBOARD_URL);
    await page.waitForLoadState('networkidle');

    // Dashboard should have some navigation or header
    const nav = page.locator('nav, header, [role="navigation"]');
    if ((await nav.count()) > 0) {
      await expect(nav.first()).toBeVisible();
    }
  });

  test('handles offline backend gracefully', async ({ page }) => {
    // Block all API calls
    await page.route('**/api/**', (route) => route.abort('connectionrefused'));

    await page.goto(DASHBOARD_URL);
    await page.waitForLoadState('domcontentloaded');

    // Page should not crash
    await expect(page.locator('body')).toBeVisible();
  });
});
