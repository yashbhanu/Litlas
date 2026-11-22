import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import type { Database } from "@/lib/db/database.types";
import { collectConsoleErrors, signInAsNewUser } from "./helpers/auth";

/**
 * Phase 5 acceptance: settings + account deletion, the profile share image, the
 * sitemap/robots, the 404 page and the landing page.
 */

const admin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

async function bookWithPlace(tag: string) {
  const { data: book } = await admin
    .from("books")
    .insert({ title: `Launch ${tag}` })
    .select("id")
    .single();
  const { data: place } = await admin
    .from("places")
    .insert({
      name: `Kyoto ${tag}`,
      precision: "city",
      country_code: "JP",
      geom: "SRID=4326;POINT(135.77 35.01)",
    })
    .select("id")
    .single();
  await admin
    .from("book_places")
    .insert({ book_id: book!.id, place_id: place!.id, source: "admin", status: "approved" });
  return { bookId: book!.id, placeId: place!.id };
}

test("settings: edit the profile, then delete the account", async ({ page, isMobile }) => {
  test.skip(isMobile, "Runs once, on desktop");
  const tag = randomUUID().slice(0, 6);
  const username = `leaver_${tag}`;
  const { bookId, placeId } = await bookWithPlace(tag);
  const userId = await signInAsNewUser(page, admin, username, "/settings");
  try {
    await admin.from("shelf_entries").insert({ user_id: userId, book_id: bookId, status: "read" });
    const errors = collectConsoleErrors(page);

    await expect(page.getByRole("heading", { name: "Settings", level: 1 })).toBeVisible();
    await page.getByLabel("Display name (optional)").fill("Leaving Reader");
    await page.getByRole("checkbox", { name: /Public profile/ }).uncheck();
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("status")).toHaveText(/Saved/);
    const { data: saved } = await admin
      .from("profiles")
      .select("display_name, is_public")
      .eq("id", userId)
      .single();
    expect(saved).toEqual({ display_name: "Leaving Reader", is_public: false });

    // Delete: the confirm button stays disabled until the username is typed.
    await page.getByRole("button", { name: "Delete my account" }).click();
    const dialog = page.getByRole("dialog", { name: "Delete your account?" });
    const confirm = dialog.getByRole("button", { name: "Delete my account forever" });
    await expect(confirm).toBeDisabled();
    await dialog.getByLabel(/to confirm/).fill(username);
    await confirm.click();
    await expect(page).toHaveURL(/\/\?account=deleted$/);

    expect((await admin.from("profiles").select("id").eq("id", userId)).data).toEqual([]);
    expect((await admin.from("shelf_entries").select("id").eq("user_id", userId)).data).toEqual([]);
    expect((await admin.auth.admin.getUserById(userId)).data.user).toBeNull();
    // Signed out: /me goes to the login page.
    await page.goto("/me");
    await expect(page).toHaveURL(/\/login/);
    expect(errors).toEqual([]);
  } finally {
    await admin.auth.admin.deleteUser(userId).catch(() => undefined);
    await admin.from("books").delete().eq("id", bookId);
    await admin.from("places").delete().eq("id", placeId);
  }
});

test("a public profile shares a map preview image", async ({ page, request, isMobile }) => {
  test.skip(isMobile, "Runs once, on desktop");
  const tag = randomUUID().slice(0, 6);
  const username = `sharer_${tag}`;
  const { bookId, placeId } = await bookWithPlace(tag);
  const { data: user } = await admin.auth.admin.createUser({
    email: `${username}@test.local`,
    email_confirm: true,
  });
  const userId = user.user!.id;
  try {
    await admin.from("profiles").insert({ id: userId, username, display_name: "Share Reader" });
    await admin.from("shelf_entries").insert({ user_id: userId, book_id: bookId, status: "read" });

    // Share metadata points at the generated image, with a large Twitter card.
    await page.goto(`/u/${username}`);
    const ogImage = await page.locator('meta[property="og:image"]').getAttribute("content");
    expect(ogImage).toMatch(new RegExp(`^http://localhost:3000/u/${username}/opengraph-image`));
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
      "content",
      "summary_large_image",
    );
    await expect(page.locator('meta[property="og:image:width"]')).toHaveAttribute(
      "content",
      "1200",
    );

    const image = await request.get(new URL(ogImage!).pathname + new URL(ogImage!).search);
    expect(image.status()).toBe(200);
    expect(image.headers()["content-type"]).toBe("image/png");
    const png = await image.body();
    expect(png.subarray(1, 4).toString()).toBe("PNG");
    expect(png.length).toBeGreaterThan(20_000);
  } finally {
    await admin.auth.admin.deleteUser(userId);
    await admin.from("books").delete().eq("id", bookId);
    await admin.from("places").delete().eq("id", placeId);
  }
});

test("sitemap, robots and the 404 page", async ({ page, request }) => {
  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain("<urlset");
  expect(sitemap).toMatch(/<loc>http:\/\/localhost:3000\/book\/[0-9a-f-]{36}<\/loc>/);
  expect(sitemap).toMatch(/<loc>http:\/\/localhost:3000\/place\/[0-9a-f-]{36}<\/loc>/);
  expect(sitemap).toMatch(/<loc>http:\/\/localhost:3000\/country\/[A-Z]{2}<\/loc>/);

  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain("Sitemap: http://localhost:3000/sitemap.xml");
  expect(robots).toContain("Disallow: /me");

  const response = await page.goto("/no-such-page");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Off the map" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Explore the map" })).toBeVisible();
});

test("landing page: sample map, featured places, sign-up call to action", async ({ page }) => {
  const errors = collectConsoleErrors(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Read around the world.");
  await expect(page.getByRole("img", { name: /Sample map/ })).toBeVisible();
  await expect(
    page.getByRole("list", { name: "Featured places" }).getByRole("listitem"),
  ).not.toHaveCount(0);
  await page.getByRole("link", { name: /Start your map, free/ }).click();
  await expect(page).toHaveURL(/\/login\?next=(%2F|\/)me$/);
  expect(errors).toEqual([]);
});
