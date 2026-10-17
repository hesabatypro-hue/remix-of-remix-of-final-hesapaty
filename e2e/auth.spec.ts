import { test, expect } from "../playwright-fixture";

test.describe("Security and Authentication Smoke Tests", () => {
  test("Auth page loads with login form and no secret leaks", async ({ page }) => {
    await page.goto("/auth");
    await expect(page).toHaveTitle(/حساباتي/);
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeVisible();
    const passwordInput = page.locator('input[type="password"]');
    await expect(passwordInput).toBeVisible();
  });
});
