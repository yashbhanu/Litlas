import { expect, type Page } from "@playwright/test";
import { getMagicLink } from "./mailpit";

/** Sign up through the magic link and onboarding; ends on /me. */
export async function signUp(page: Page, email: string, username: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByRole("status")).toContainText(email);
  await page.goto(await getMagicLink(email));
  await expect(page).toHaveURL(/\/onboarding/);
  await page.getByLabel("Username").fill(username);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/me$/);
}

/** Collect browser console errors and uncaught exceptions. */
export function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text().slice(0, 500));
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}
