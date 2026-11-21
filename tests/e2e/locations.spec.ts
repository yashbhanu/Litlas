import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Browser, type Page } from "@playwright/test";
import type { Database } from "@/lib/db/database.types";
import { collectConsoleErrors, signInAsNewUser } from "./helpers/auth";

/**
 * Phase 4 acceptance: a suggestion shows as pending to other readers, 3 votes approve it
 * and it appears on Explore; users can't vote twice or on their own suggestion; an admin
 * can approve, reject and merge duplicate places. Place search hits live Photon.
 */

const admin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

const tag = randomUUID().slice(0, 6);
const userIds: string[] = [];
const bookIds: string[] = [];
const placeIds: string[] = [];

test.afterAll(async () => {
  for (const id of userIds) await admin.auth.admin.deleteUser(id);
  if (bookIds.length) await admin.from("books").delete().in("id", bookIds);
  if (placeIds.length) await admin.from("places").delete().in("id", placeIds);
});

async function newBook(title: string) {
  const { data, error } = await admin
    .from("books")
    .insert({ title, authors: ["E2E Author"] })
    .select("id")
    .single();
  if (error) throw error;
  bookIds.push(data.id);
  return data.id;
}

async function userPage(browser: Browser, label: string, next: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  userIds.push(await signInAsNewUser(page, admin, `${label}_${tag}`, next));
  return page;
}

test("a suggestion is pending to others, and 3 votes put it on Explore", async ({
  browser,
  isMobile,
}) => {
  test.skip(isMobile, "Runs once, on desktop");
  test.setTimeout(120_000);
  const bookId = await newBook(`Saga ${tag}`);
  const bookPath = `/book/${bookId}`;

  // Alice suggests Reykjavík with the PlacePicker (Photon search, city precision).
  const alice = await userPage(browser, "alice", bookPath);
  const aliceErrors = collectConsoleErrors(alice);
  await alice.getByRole("button", { name: "Suggest a location" }).click();
  const dialog = alice.getByRole("dialog");
  await dialog.getByLabel("Search for a place").fill("Reykjavik");
  await dialog
    .getByRole("list", { name: "Place results" })
    .getByRole("button", { name: /Reykjavik.*Iceland/ })
    .first()
    .click();
  await expect(dialog.getByRole("radio", { name: /City or place/ })).toBeChecked();
  await dialog.getByRole("button", { name: "Suggest this location" }).click();
  await expect(dialog.getByRole("status")).toContainText("2 more readers confirm");
  await dialog.getByRole("button", { name: "Done" }).click();

  const pending = alice.getByRole("list", { name: "Pending suggestions" });
  await expect(pending).toContainText("Reykjavik");
  await expect(pending).toContainText("1 of 3 confirmations");
  await expect(pending.getByText("Your suggestion")).toBeVisible();
  await expect(pending.getByRole("button", { name: /Confirm/ })).toHaveCount(0);

  const { data: link } = await admin
    .from("book_places")
    .select("id, status, source, place:places!inner(id, name, osm_id)")
    .eq("book_id", bookId)
    .single();
  expect(link).toMatchObject({ status: "pending", source: "user" });
  placeIds.push(link!.place.id);

  // Alice can't vote on her own suggestion (API check too).
  const own = await alice.request.post(`/api/locations/${link!.id}/vote`);
  expect(own.status()).toBe(403);

  // Signed-out visitors see it as pending, and it isn't on the map yet.
  const visitor = await (await browser.newContext()).newPage();
  const publicBook = (await (await visitor.request.get(`/api/books/${bookId}`)).json()) as {
    book: { places: unknown[] };
    suggestions: { name: string; votes: number }[];
  };
  expect(publicBook.book.places).toEqual([]);
  expect(publicBook.suggestions).toEqual([
    expect.objectContaining({ name: "Reykjavik", votes: 1 }),
  ]);

  // Bob confirms: 2 of 3. Voting again is refused.
  const bob = await userPage(browser, "bob", bookPath);
  const bobPending = bob.getByRole("list", { name: "Pending suggestions" });
  await bobPending.getByRole("button", { name: "Confirm Reykjavik" }).click();
  await expect(bobPending).toContainText("2 of 3 confirmations");
  await expect(bobPending.getByText("You confirmed")).toBeVisible();
  const twice = await bob.request.post(`/api/locations/${link!.id}/vote`);
  expect(twice.status()).toBe(409);

  // Carol confirms: approved. It moves to "Where it's set" and onto Explore.
  const carol = await userPage(browser, "carol", bookPath);
  await carol
    .getByRole("list", { name: "Pending suggestions" })
    .getByRole("button", { name: "Confirm Reykjavik" })
    .click();
  await expect(carol.getByRole("list", { name: "Settings" })).toContainText("Reykjavik", {
    timeout: 10_000,
  });
  await expect(carol.getByText("Readers suggested", { exact: false })).toHaveCount(0);
  await expect(carol.getByRole("list", { name: "Settings" })).toContainText("Suggested by readers");
  expect(
    (await admin.from("book_places").select("status").eq("id", link!.id).single()).data?.status,
  ).toBe("approved");

  const explore = (await (
    await visitor.request.get("/api/explore?bbox=-22.5,63.5,-21.5,64.5&zoom=9")
  ).json()) as { features: { properties: { placeId: string; bookCount: number } }[] };
  expect(explore.features.map((f) => f.properties.placeId)).toContain(link!.place.id);
  await visitor.goto(`/place/${link!.place.id}`);
  await expect(visitor.getByRole("list", { name: /Books set in Reykjavik/ })).toContainText(
    `Saga ${tag}`,
  );

  expect(aliceErrors).toEqual([]);
});

test("an admin can approve, reject and merge duplicate places", async ({
  browser,
  page,
  isMobile,
}) => {
  test.skip(isMobile, "Runs once, on desktop");
  test.setTimeout(90_000);

  // Data: an existing Wikidata-style place, and three pending suggestions.
  const bookId = await newBook(`Moderated ${tag}`);
  const { data: places } = await admin
    .from("places")
    .insert([
      {
        name: `Lisbon ${tag}`,
        precision: "city",
        country_code: "PT",
        wikidata_id: `Q9${Date.now()}`,
        geom: "SRID=4326;POINT(-9.14 38.72)",
      },
      {
        name: `lisbon ${tag}`,
        precision: "city",
        country_code: "PT",
        geom: "SRID=4326;POINT(-9.13 38.71)",
      }, // duplicate
      {
        name: `Porto ${tag}`,
        precision: "city",
        country_code: "PT",
        geom: "SRID=4326;POINT(-8.61 41.15)",
      },
      { name: `Atlantis ${tag}`, precision: "fictional" },
    ])
    .select("id, name");
  const id = (name: string) => places!.find((p) => p.name === name)!.id;
  placeIds.push(...places!.map((p) => p.id));
  const suggester = await admin.auth.admin.createUser({
    email: `sug_${tag}@test.local`,
    email_confirm: true,
  });
  userIds.push(suggester.data.user!.id);
  await admin.from("profiles").insert({ id: suggester.data.user!.id, username: `sug_${tag}` });
  const { data: links } = await admin
    .from("book_places")
    .insert(
      [`lisbon ${tag}`, `Porto ${tag}`, `Atlantis ${tag}`].map((name) => ({
        book_id: bookId,
        place_id: id(name),
        source: "user" as const,
        status: "pending" as const,
        created_by: suggester.data.user!.id,
      })),
    )
    .select("id, place_id");
  const linkFor = (name: string) => links!.find((l) => l.place_id === id(name))!.id;

  // A regular reader gets a 404 at /moderate and a 403 from the API.
  const reader = await userPage(browser, "reader", "/me");
  await reader.goto("/moderate");
  await expect(reader.getByText("This page could not be found.")).toBeVisible();
  const forbidden = await reader.request.post(`/api/admin/locations/${linkFor(`Porto ${tag}`)}`, {
    data: { action: "approve" },
  });
  expect(forbidden.status()).toBe(403);

  // The admin works the queue.
  userIds.push(await signInAsNewUser(page, admin, `mod_${tag}`, "/me"));
  await admin.from("profiles").update({ is_admin: true }).eq("username", `mod_${tag}`);
  await page.goto("/moderate");
  await expect(page.getByRole("link", { name: "Moderate", exact: true })).toBeVisible();

  const queue = page.getByRole("list", { name: "Pending suggestions" });
  const item = (name: string) =>
    queue.getByRole("listitem", { name: `${name} for Moderated ${tag}`, exact: true });

  await item(`Porto ${tag}`).getByRole("button", { name: "Approve" }).click();
  await expect(item(`Porto ${tag}`)).toHaveCount(0);
  await item(`Atlantis ${tag}`).getByRole("button", { name: "Reject" }).click();
  await expect(item(`Atlantis ${tag}`)).toHaveCount(0);
  await item(`lisbon ${tag}`)
    .getByRole("button", { name: `Merge lisbon ${tag} into Lisbon ${tag}` })
    .click();
  await expect(item(`lisbon ${tag}`)).toHaveCount(0);
  // The suggestion now points at the existing place and is still pending.
  await expect(item(`Lisbon ${tag}`)).toBeVisible();

  const { data: after } = await admin
    .from("book_places")
    .select("status, place_id")
    .eq("book_id", bookId)
    .order("status");
  expect(after).toEqual(
    expect.arrayContaining([
      { status: "approved", place_id: id(`Porto ${tag}`) },
      { status: "rejected", place_id: id(`Atlantis ${tag}`) },
      { status: "pending", place_id: id(`Lisbon ${tag}`) }, // merged, still pending
    ]),
  );
  expect(
    (
      await admin
        .from("places")
        .select("id")
        .eq("id", id(`lisbon ${tag}`))
    ).data,
  ).toEqual([]);

  // The approved suggestion shows on the book page.
  await page.goto(`/book/${bookId}`);
  await expect(page.getByRole("list", { name: "Settings" })).toContainText(`Porto ${tag}`);
});
