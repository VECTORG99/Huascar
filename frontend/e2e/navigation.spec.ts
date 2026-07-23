import { expect, test } from "@playwright/test";

test("landing page loads", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /huascar/i })).toBeVisible();
});

test("creator wizard route accessible", async ({ page }) => {
  await page.goto("/agents/new");
  await expect(
    page.getByRole("heading", { name: /agent creator/i })
  ).toBeVisible();
});

test("dashboard route accessible", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(
    page.getByRole("heading", { name: /dashboard/i })
  ).toBeVisible();
});
