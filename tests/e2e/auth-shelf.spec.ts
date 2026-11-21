import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import type { Database } from "@/lib/db/database.types";
import { getMagicLink } from "./helpers/mailpit";

/**
 * Phase 1 acceptance: a new user signs up with a magic link, picks a username, lands on
 * /me, searches "Ulysses", adds it (creating books + shelf_entries rows), then removes it.
 * Needs local Supabase running. Book search hits the live Open Library API.
 */

const admin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

const ULYSSES = "OL86318W";

test.describe("sign up and manage shelf", () => {
  const id = randomUUID().slice(0, 8);
  const email = `e2e_${id}@test.local`;
  const username = `e2e_${id}`;
  let userId: string | undefined;

  test.afterAll(async () => {
    if (userId) await admin.auth.admin.deleteUser(userId);
  });

  test("new user signs up, picks a username, adds and removes a book", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "Full flow runs once, on desktop");
    test.setTimeout(90_000);

    // Fail on any browser console error (e.g. Next.js prerender/runtime errors).
    const consoleErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text().slice(0, 500));
    });
    page.on("pageerror", (error) => consoleErrors.push(error.message));

    // Signed-out visitors are sent to /login, remembering where they were going.
    await page.goto("/me");
    await expect(page).toHaveURL(/\/login\?next=%2Fme$/);

    // Magic link sign-up.
    await page.getByLabel("Email").fill(email);
    await page.getByRole("button", { name: "Email me a sign-in link" }).click();
    await expect(page.getByRole("status")).toContainText(email);

    await page.goto(await getMagicLink(email));

    // First sign-in goes to onboarding, with a username suggested from the email.
    await expect(page).toHaveURL(/\/onboarding/);
    const usernameInput = page.getByLabel("Username");
    await expect(usernameInput).toHaveValue(`e2e_${id}`);
    await usernameInput.fill(username);
    await page.getByLabel("Display name (optional)").fill("E2E Reader");
    await page.getByRole("button", { name: "Continue" }).click();

    // Lands on /me with an empty shelf.
    await expect(page).toHaveURL(/\/me$/);
    await expect(page.getByRole("heading", { name: "My shelf" })).toBeVisible();
    await expect(page.getByText(`@${username}`)).toBeVisible();
    await expect(page.getByText("Your shelf is empty")).toBeVisible();

    const { data: profile } = await admin
      .from("profiles")
      .select("id")
      .eq("username", username)
      .single();
    userId = profile!.id;

    // Search Open Library: results show covers.
    await page.getByRole("button", { name: "Add a book" }).first().click();
    const dialog = page.getByRole("dialog", { name: "Add a book" });
    await dialog.getByLabel("Search by title or author").fill("Ulysses");
    const results = dialog.getByRole("list", { name: "Search results" });
    await expect(results).toBeVisible({ timeout: 20_000 });
    const joyce = results.getByRole("button", { name: /Ulysses\s+James Joyce/ }).first();
    await expect(joyce.getByRole("img", { name: "Cover of Ulysses" })).toBeVisible();
    await joyce.click();

    // Add as read, rated 5.
    await dialog.getByLabel("Rating (optional)").selectOption("5");
    await dialog.getByLabel("Finished on (optional)").fill("2026-06-16");
    await dialog.getByRole("button", { name: "Add to shelf" }).click();
    await expect(dialog).toBeHidden({ timeout: 20_000 });

    const shelf = page.getByRole("list", { name: "Books on your shelf" });
    await expect(shelf.getByText("Ulysses", { exact: true })).toBeVisible();
    await expect(shelf.getByLabel("Rated 5 out of 5")).toBeVisible();

    // Rows exist in books and shelf_entries.
    const { data: book } = await admin
      .from("books")
      .select("id, title, authors, cover_id")
      .eq("ol_work_id", ULYSSES)
      .single();
    expect(book).toMatchObject({ title: "Ulysses", authors: ["James Joyce"] });
    expect(book!.cover_id).not.toBeNull();
    const { data: entries } = await admin
      .from("shelf_entries")
      .select("book_id, status, rating, finished_on")
      .eq("user_id", userId);
    expect(entries).toEqual([
      { book_id: book!.id, status: "read", rating: 5, finished_on: "2026-06-16" },
    ]);

    // Filters.
    await page.getByRole("button", { name: /^Want to read/ }).click();
    await expect(page.getByText("No books with this status yet.")).toBeVisible();
    await page.getByRole("button", { name: /^All/ }).click();

    // Change status in place.
    await shelf.getByLabel("Status for Ulysses").selectOption("reading");
    await expect
      .poll(async () => {
        const { data } = await admin
          .from("shelf_entries")
          .select("status")
          .eq("user_id", userId!)
          .single();
        return data?.status;
      })
      .toBe("reading");

    // Remove.
    await shelf.getByRole("button", { name: "Remove Ulysses from shelf" }).click();
    await expect(page.getByText("Your shelf is empty")).toBeVisible();
    const { count } = await admin
      .from("shelf_entries")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    expect(count).toBe(0);

    expect(consoleErrors).toEqual([]);
  });

  test("protected pages redirect signed-out visitors", async ({ page }) => {
    for (const path of ["/add", "/onboarding"]) {
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(`/login\\?next=${encodeURIComponent(path)}$`));
    }
  });
});
