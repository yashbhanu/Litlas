import type { SupabaseClient } from "@supabase/supabase-js";
import { expect, type Page } from "@playwright/test";
import type { Database } from "@/lib/db/database.types";
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

/**
 * Fast sign-in for tests that aren't about sign-up: create a confirmed user with a
 * profile, then open an admin-generated magic link through /auth/callback.
 */
export async function signInAsNewUser(
  page: Page,
  admin: SupabaseClient<Database>,
  username: string,
  next = "/me",
): Promise<string> {
  const email = `${username}@test.local`;
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
  });
  if (error) throw error;
  const userId = created.user.id;
  const { error: profileError } = await admin.from("profiles").insert({ id: userId, username });
  if (profileError) throw profileError;
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkError) throw linkError;
  const params = new URLSearchParams({
    token_hash: link.properties.hashed_token,
    type: "magiclink",
    next,
  });
  await page.goto(`/auth/callback?${params}`);
  await expect(page).toHaveURL(new RegExp(`${next.replace(/[/?]/g, "\\$&")}$`));
  return userId;
}
