import { expect, test } from "@playwright/test";

test("login page explains required credentials", async ({ page }) => {
  await page.route("**/api/v1/auth/csrf/", async (route) => {
    await route.fulfill({ json: { csrfToken: "test-csrf-token" } });
  });
  await page.route("**/api/v1/auth/me/", async (route) => {
    await route.fulfill({ json: { authenticated: false } });
  });

  await page.goto("/login");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByText("Enter your username.")).toBeVisible();
  await expect(page.getByText("Enter your password.")).toBeVisible();
});
