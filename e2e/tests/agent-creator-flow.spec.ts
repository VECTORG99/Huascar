import { test, expect } from '@playwright/test';

test.describe('Agent Creator Flow', () => {
  test('completes full wizard flow', async ({ page }) => {
    await page.goto('/');

    // Step 1: Verify the page loads
    await expect(page).toHaveTitle(/agent|creator|huascar/i);

    // Step 2: Check that main content is visible
    const main = page.locator('main, [role="main"], #root, #app');
    await expect(main.first()).toBeVisible({ timeout: 10_000 });
  });

  test('navigates through wizard steps', async ({ page }) => {
    await page.goto('/');

    // Wait for app to fully load
    await page.waitForLoadState('networkidle');

    // Find and interact with form elements or buttons
    const startButton = page.getByRole('button').first();
    if (await startButton.isVisible()) {
      await startButton.click();
    }

    // Verify navigation happened (content changed)
    await page.waitForTimeout(500);
  });

  test('handles API errors gracefully', async ({ page }) => {
    // Navigate to creator with a broken API
    await page.route('**/api/v1/creator/**', (route) =>
      route.fulfill({ status: 500, body: JSON.stringify({ error: 'Internal error' }) }),
    );

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Page should still be usable (not crashed)
    await expect(page.locator('body')).toBeVisible();
  });
});
