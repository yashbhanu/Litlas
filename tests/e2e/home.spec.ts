import { expect, test } from "@playwright/test";

test("home page loads", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Literary World Map/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Literary World Map");
});
