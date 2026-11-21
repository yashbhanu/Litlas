import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Locator, type Page } from "@playwright/test";
import type { Database } from "@/lib/db/database.types";
import type { UserMap } from "@/lib/geo/map";
import { collectConsoleErrors, signUp } from "./helpers/auth";

/**
 * Phase 2 acceptance: settings from Wikidata, pins and shaded countries, the
 * "Where is this book set?" prompt, stats, the public profile, and the 375 px layout.
 * The desktop flow hits live Open Library and Wikidata; the mobile test uses seeded rows.
 */

const admin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

async function addBook(page: Page, query: string, result: RegExp) {
  await page.getByRole("button", { name: "Add a book" }).click();
  const dialog = page.getByRole("dialog", { name: "Add a book" });
  await dialog.getByLabel("Search by title or author").fill(query);
  const results = dialog.getByRole("list", { name: "Search results" });
  await expect(results).toBeVisible({ timeout: 20_000 });
  await results.getByRole("button", { name: result }).first().click();
  await dialog.getByRole("button", { name: "Add to shelf" }).click();
  return dialog;
}

function stat(page: Page, label: RegExp): Locator {
  return page
    .getByTestId("stats")
    .locator("div")
    .filter({ has: page.getByText(label) })
    .locator("dd");
}

test.describe("personal map", () => {
  const id = randomUUID().slice(0, 8);
  const username = `map_${id}`;
  let userId: string | undefined;

  test.afterAll(async () => {
    if (userId) await admin.auth.admin.deleteUser(userId);
  });

  test("settings from Wikidata appear as pins, shaded countries and stats", async ({
    page,
    browser,
    isMobile,
  }) => {
    test.skip(isMobile, "Full flow runs once, on desktop");
    test.setTimeout(180_000);
    const consoleErrors = collectConsoleErrors(page);

    await signUp(page, `map_${id}@test.local`, username);
    const { data: profile } = await admin
      .from("profiles")
      .select("id")
      .eq("username", username)
      .single();
    userId = profile!.id;

    // The map renders (WebGL canvas) with an empty shelf.
    await expect(page.getByTestId("map").locator("canvas")).toBeVisible({ timeout: 20_000 });

    // Ulysses: set in Dublin → a pin in Ireland. The dialog closes (no prompt needed).
    const ulysses = await addBook(page, "Ulysses", /Ulysses\s+James Joyce/);
    await expect(ulysses).toBeHidden({ timeout: 60_000 });

    const byCountry = page.getByRole("list", { name: "Books by country" });
    await expect(byCountry.getByRole("heading", { name: /Ireland/ })).toBeVisible();
    await expect(byCountry.getByText(/Dublin/)).toBeVisible();
    const shelf = page.getByRole("list", { name: "Books on your shelf" });
    await expect(shelf.getByText(/Dublin/)).toBeVisible();

    const map = (await (await page.request.get("/api/me/map")).json()) as UserMap;
    const dublin = map.pins.features.find((f) => f.properties.placeName === "Dublin");
    expect(dublin?.geometry.coordinates[0]).toBeCloseTo(-6.26, 1);
    expect(dublin?.geometry.coordinates[1]).toBeCloseTo(53.35, 1);
    expect(map.countries).toEqual(["IE"]);

    // One Hundred Years of Solitude: Wikidata's only setting is the fictional Macondo.
    const solitude = await addBook(page, "One Hundred Years of Solitude", /Gabriel García Márquez/);
    await expect(solitude).toBeHidden({ timeout: 60_000 });
    const fictional = page.getByRole("list", { name: "Fictional settings" });
    await expect(fictional.getByText(/Macondo/)).toBeVisible();

    // A book with no setting on Wikidata asks "Where is this book set?".
    const caterpillar = await addBook(
      page,
      "The Very Hungry Caterpillar",
      /Very Hungry Caterpillar\s+Eric Carle/,
    );
    await expect(caterpillar.getByRole("heading", { name: "Where is this book set?" })).toBeVisible(
      {
        timeout: 60_000,
      },
    );
    await caterpillar.getByRole("button", { name: "Skip for now" }).click();
    await expect(caterpillar).toBeHidden();
    await expect(
      page.getByRole("list", { name: "No setting yet" }).getByText(/Caterpillar/),
    ).toBeVisible();
    await expect(shelf.getByText("No setting yet")).toBeVisible();

    // Stats: 3 books read, 1 country (Ireland), 1 continent (Europe).
    await expect(stat(page, /Books read/)).toHaveText("3");
    await expect(stat(page, /^Country$/)).toHaveText("1");
    await expect(stat(page, /^Continent$/)).toHaveText("1");
    await expect(page.getByRole("list", { name: "Top countries" })).toContainText("Ireland");

    // Public profile, signed out: same map and stats, read-only.
    const visitor = await browser.newContext();
    const publicPage = await visitor.newPage();
    await publicPage.goto(`/u/${username}`);
    await expect(publicPage).toHaveTitle(new RegExp(`@${username}'s reading map`));
    await expect(
      publicPage.getByRole("heading", { name: `@${username}'s reading map` }),
    ).toBeVisible();
    await expect(stat(publicPage, /Books read/)).toHaveText("3");
    await expect(publicPage.getByRole("list", { name: "Books by country" })).toContainText(
      "Dublin",
    );
    await expect(publicPage.getByRole("button", { name: "Add a book" })).toHaveCount(0);
    const publicApi = await publicPage.request.get(`/api/users/${username}/map`);
    expect(publicApi.status()).toBe(200);

    // Going private hides the map from visitors (page and API).
    await admin.from("profiles").update({ is_public: false }).eq("id", userId);
    await publicPage.reload();
    await expect(publicPage.getByText("This reader keeps their map private.")).toBeVisible();
    expect((await publicPage.request.get(`/api/users/${username}/map`)).status()).toBe(403);
    await visitor.close();

    expect(consoleErrors).toEqual([]);
  });
});

test.describe("map layout on a phone", () => {
  const id = randomUUID().slice(0, 8);
  const username = `phone_${id}`;
  let userId: string | undefined;
  let bookId: string | undefined;
  let placeId: string | undefined;

  test.beforeAll(async () => {
    const { data: user } = await admin.auth.admin.createUser({
      email: `phone_${id}@test.local`,
      email_confirm: true,
    });
    userId = user.user!.id;
    await admin.from("profiles").insert({ id: userId, username });
    const { data: book } = await admin
      .from("books")
      .insert({
        ol_work_id: `OL${randomUUID().replace(/\D/g, "").slice(0, 10)}5W`,
        title: "Phone Test Novel",
        authors: ["Test Author"],
      })
      .select("id")
      .single();
    bookId = book!.id;
    const { data: place } = await admin
      .from("places")
      .insert({
        name: "Lisbon (test)",
        precision: "city",
        country_code: "PT",
        geom: "SRID=4326;POINT(-9.14 38.72)",
      })
      .select("id")
      .single();
    placeId = place!.id;
    await admin
      .from("book_places")
      .insert({ book_id: bookId, place_id: placeId, source: "admin", status: "approved" });
    await admin.from("shelf_entries").insert({ user_id: userId, book_id: bookId, status: "read" });
  });

  test.afterAll(async () => {
    if (userId) await admin.auth.admin.deleteUser(userId);
    if (bookId) await admin.from("books").delete().eq("id", bookId);
    if (placeId) await admin.from("places").delete().eq("id", placeId);
  });

  test("375 px: map on top, list in an expandable bottom sheet, no sideways scroll", async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "Phone layout");
    const consoleErrors = collectConsoleErrors(page);
    await page.goto(`/u/${username}`);

    const map = page.getByTestId("map");
    const sheet = page.getByRole("complementary", { name: /shelf and stats/ });
    await expect(map.locator("canvas")).toBeVisible({ timeout: 20_000 });
    await expect(sheet).toBeVisible();

    const mapBox = (await map.boundingBox())!;
    const sheetBox = (await sheet.boundingBox())!;
    expect(mapBox.width).toBeGreaterThanOrEqual(370);
    expect(sheetBox.width).toBeGreaterThanOrEqual(370);
    // Sheet sits below the map (bottom sheet, not a side panel).
    expect(sheetBox.y).toBeGreaterThanOrEqual(mapBox.y + mapBox.height - 1);
    expect(mapBox.height).toBeGreaterThan(200);

    await expect(sheet.getByRole("list", { name: "Books by country" })).toContainText(
      "Lisbon (test)",
    );
    await expect(stat(page, /Book read/)).toHaveText("1");

    // Expand the sheet, then collapse it again.
    const toggle = sheet.getByRole("button", { name: "Expand list" });
    await toggle.click();
    await expect(sheet.getByRole("button", { name: "Show more map" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    await expect
      .poll(async () => (await sheet.boundingBox())!.height)
      .toBeGreaterThan(sheetBox.height + 100);
    await sheet.getByRole("button", { name: "Show more map" }).click();
    await expect(sheet.getByRole("button", { name: "Expand list" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(375);
    expect(consoleErrors).toEqual([]);
  });
});
