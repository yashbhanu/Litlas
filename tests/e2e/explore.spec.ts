import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page, type Request } from "@playwright/test";
import type { Database } from "@/lib/db/database.types";
import { collectConsoleErrors } from "./helpers/auth";

/**
 * Phase 3 acceptance: /explore loads pins for the visible area only, clicking a country
 * lists its books (paginated), and place/book pages render server-side with titles.
 * Uses its own rows (25 books in Chad, a pin in Pitcairn), so it doesn't depend on the
 * Wikidata seed.
 */

const admin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

const tag = randomUUID().slice(0, 6);
const pinName = `Adamstown ${tag}`;
let bookIds: string[] = [];
let pinPlaceId = "";
let chadPlaceId = "";

test.beforeAll(async () => {
  const { data: books, error } = await admin
    .from("books")
    .insert(
      Array.from({ length: 25 }, (_, i) => ({
        title: `Chad Novel ${tag} ${String(i + 1).padStart(2, "0")}`,
        authors: ["Test Author"],
        first_publish_year: 1990 + i,
        description: "A test novel set in Chad.",
      })),
    )
    .select("id");
  if (error) throw error;
  bookIds = books.map((b) => b.id);

  const { data: places, error: placeError } = await admin
    .from("places")
    .insert([
      { name: `Chad (${tag})`, precision: "country", country_code: "TD" },
      {
        name: pinName,
        precision: "city",
        country_code: "PN",
        geom: "SRID=4326;POINT(-130.1 -25.07)",
      },
    ])
    .select("id");
  if (placeError) throw placeError;
  [chadPlaceId, pinPlaceId] = places.map((p) => p.id) as [string, string];

  const { error: linkError } = await admin.from("book_places").insert([
    ...bookIds.map((id) => ({
      book_id: id,
      place_id: chadPlaceId,
      source: "admin" as const,
      status: "approved" as const,
    })),
    { book_id: bookIds[0]!, place_id: pinPlaceId, source: "wikidata", status: "approved" },
  ]);
  if (linkError) throw linkError;
});

test.afterAll(async () => {
  await admin.from("books").delete().in("id", bookIds);
  await admin.from("places").delete().in("id", [chadPlaceId, pinPlaceId]);
});

const isExplore = (request: Request) => new URL(request.url()).pathname === "/api/explore";
const bboxOf = (request: Request) =>
  new URL(request.url()).searchParams.get("bbox")!.split(",").map(Number) as [
    number,
    number,
    number,
    number,
  ];

async function jumpTo(page: Page, query: string, result: RegExp) {
  const panel = page.getByRole("complementary", { name: "Explore books by place" });
  await panel.getByLabel("Jump to a place").fill(query);
  await panel
    .getByRole("list", { name: "Place search results" })
    .getByRole("button", { name: result })
    .click();
}

test("explore loads pins for the visible area only and lists books on click", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "Desktop map interactions");
  test.setTimeout(90_000);
  const consoleErrors = collectConsoleErrors(page);
  const requests: Request[] = [];
  page.on("request", (request) => {
    if (isExplore(request)) requests.push(request);
  });

  // Open zoomed in on our pin (the view lives in the URL hash): only that area loads.
  await page.goto("/explore#8/-25.07/-130.1");
  await expect(page).toHaveTitle(/Explore books by place/);
  await expect(page.getByTestId("explore-map").locator("canvas")).toBeVisible({ timeout: 20_000 });
  await expect.poll(() => requests.length).toBeGreaterThan(0);
  const [w, s, e, n] = bboxOf(requests[0]!);
  expect(e - w).toBeLessThan(5);
  expect(n - s).toBeLessThan(5);
  expect(w).toBeLessThan(-130.1);
  expect(e).toBeGreaterThan(-130.1);
  expect(s).toBeLessThan(-25.07);
  expect(n).toBeGreaterThan(-25.07);
  const body = (await (await requests[0]!.response())!.json()) as {
    features: { properties: { name: string } }[];
  };
  expect(body.features.map((f) => f.properties.name)).toContain(pinName);

  // The list view next to the map shows the pin; picking it lists its books.
  const panel = page.getByRole("complementary", { name: "Explore books by place" });
  await panel
    .getByRole("list", { name: "Places in view" })
    .getByRole("button", { name: new RegExp(pinName) })
    .click();
  await expect(panel.getByRole("heading", { name: `Books set in ${pinName}` })).toBeVisible();
  await expect(panel.getByRole("list", { name: `Books set in ${pinName}` })).toContainText(
    `Chad Novel ${tag} 01`,
  );

  // Panning a little stays inside the padded box: no new request.
  await page.waitForTimeout(500);
  const before = requests.length;
  const map = page.getByTestId("explore-map").locator("canvas");
  const boxOnScreen = (await map.boundingBox())!;
  await page.mouse.move(
    boxOnScreen.x + boxOnScreen.width / 2,
    boxOnScreen.y + boxOnScreen.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    boxOnScreen.x + boxOnScreen.width / 2 + 60,
    boxOnScreen.y + boxOnScreen.height / 2 + 20,
    {
      steps: 5,
    },
  );
  await page.mouse.up();
  await page.waitForTimeout(800);
  expect(requests.length).toBe(before);

  // Close the list, jump to Chad, then click the middle of the country on the map.
  await panel.getByRole("button", { name: "Close book list" }).click();
  await jumpTo(page, "Chad", /^Chad\s*Country$/);
  await expect(panel.getByRole("heading", { name: "Books set in Chad" })).toBeVisible();
  await panel.getByRole("button", { name: "Close book list" }).click();
  // Wait for the fly-to to finish: the URL hash (#zoom/lat/lng) settles over Chad.
  await expect
    .poll(
      () => {
        const [, lat, lng] = new URL(page.url()).hash.slice(1).split("/").map(Number);
        return Math.abs(lat! - 15.4) < 2 && Math.abs(lng! - 18.7) < 2;
      },
      { timeout: 15_000 },
    )
    .toBe(true);
  await page.waitForTimeout(500);
  const canvas = (await map.boundingBox())!;
  await page.mouse.click(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);

  const chadList = panel.getByRole("list", { name: "Books set in Chad" });
  await expect(panel.getByRole("heading", { name: "Books set in Chad" })).toBeVisible();
  await expect(chadList.getByRole("listitem")).toHaveCount(20);
  await expect(panel.getByText(/Page 1 of \d+/)).toBeVisible();
  await panel.getByRole("button", { name: "Next" }).click();
  await expect(panel.getByText(/Page 2 of \d+/)).toBeVisible();

  expect(consoleErrors).toEqual([]);
});

test("place and book pages render on the server with titles", async ({ page, request }) => {
  // Raw HTML from the server, before any client JS.
  const placeHtml = await (await request.get(`/place/${chadPlaceId}`)).text();
  expect(placeHtml).toContain(`<title>Books set in Chad (${tag}) · Litlas</title>`);
  expect(placeHtml).toContain(`Chad Novel ${tag} 01`);
  expect(placeHtml).not.toContain(`Chad Novel ${tag} 21`); // page 2

  const page2Html = await (await request.get(`/place/${chadPlaceId}?page=2`)).text();
  expect(page2Html).toContain(`Chad Novel ${tag} 21`);
  expect(page2Html.replaceAll("<!-- -->", "")).toContain("Page 2 of 2");

  const bookHtml = await (await request.get(`/book/${bookIds[0]}`)).text();
  expect(bookHtml).toContain(`<title>Chad Novel ${tag} 01 by Test Author · Litlas</title>`);
  expect(bookHtml).toContain(pinName);
  expect(bookHtml).toContain("Added by a moderator");
  expect(bookHtml).toContain("From Wikidata");

  // Malformed ids are a real 404 (proxy). Unknown ids show the not-found page with
  // noindex: with Cache Components the 200 status is sent before the lookup runs.
  expect((await request.get("/place/not-a-uuid")).status()).toBe(404);
  expect((await request.get("/book/123")).status()).toBe(404);
  const missing = await (await request.get(`/book/${randomUUID()}`)).text();
  expect(missing).toContain('<meta name="robots" content="noindex"/>');

  // In the browser: the book page links to its place, and signed-out readers are asked to sign in.
  await page.goto(`/book/${bookIds[0]}`);
  await expect(page).toHaveTitle(`Chad Novel ${tag} 01 by Test Author · Litlas`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`Chad Novel ${tag} 01`);
  await page.getByRole("button", { name: `Add Chad Novel ${tag} 01 to shelf` }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Add to shelf" }).click();
  await expect(page.getByRole("dialog").getByRole("link", { name: "Sign in" })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("link", { name: pinName }).click();
  await expect(page).toHaveURL(new RegExp(`/place/${pinPlaceId}$`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`Books set in ${pinName}`);
});
