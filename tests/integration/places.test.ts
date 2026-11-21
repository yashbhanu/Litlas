import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ensureBookSettings } from "@/lib/db/settings";
import type { WikidataClient, WikidataPlace } from "@/lib/external/wikidata";
import { adminClient, anonClient, createTestUser, uniqueUsername, type TestUser } from "./supabase";

/** Unique fake Wikidata ids so reruns never collide with real or earlier test rows. */
const fakeQid = () => `Q9${Math.floor(Math.random() * 1e12)}`;

describe("RLS: places, book_places, book_place_coords", () => {
  const admin = adminClient();
  const anon = anonClient();
  let alice: TestUser;
  let bob: TestUser;
  let bookId: string;
  let approvedPlaceId: string;
  let pendingPlaceId: string;

  beforeAll(async () => {
    [alice, bob] = await Promise.all([
      createTestUser(admin, "alice"),
      createTestUser(admin, "bob"),
    ]);
    for (const user of [alice, bob]) {
      const { error } = await user.client
        .from("profiles")
        .insert({ id: user.id, username: uniqueUsername("p") });
      expect(error).toBeNull();
    }

    const { data: book, error: bookError } = await admin
      .from("books")
      .insert({ ol_work_id: `OL${Date.now()}9W`, title: "Places Test Book" })
      .select("id")
      .single();
    expect(bookError).toBeNull();
    bookId = book!.id;

    const { data: places, error: placesError } = await admin
      .from("places")
      .insert([
        {
          name: "Test Dublin",
          wikidata_id: fakeQid(),
          precision: "city",
          country_code: "IE",
          geom: "SRID=4326;POINT(-6.26 53.35)",
        },
        {
          name: "Test Suggested Town",
          precision: "city",
          country_code: "FR",
          geom: "SRID=4326;POINT(2 48)",
        },
      ])
      .select("id");
    expect(placesError).toBeNull();
    [approvedPlaceId, pendingPlaceId] = places!.map((p) => p.id) as [string, string];

    const { error: linkError } = await admin.from("book_places").insert([
      { book_id: bookId, place_id: approvedPlaceId, source: "wikidata", status: "approved" },
      {
        book_id: bookId,
        place_id: pendingPlaceId,
        source: "user",
        status: "pending",
        created_by: alice.id,
      },
    ]);
    expect(linkError).toBeNull();
  });

  afterAll(async () => {
    await Promise.all([alice, bob].filter(Boolean).map((u) => admin.auth.admin.deleteUser(u.id)));
    if (bookId) await admin.from("books").delete().eq("id", bookId);
    await admin.from("places").delete().in("id", [approvedPlaceId, pendingPlaceId].filter(Boolean));
  });

  it("places are publicly readable", async () => {
    const { data, error } = await anon.from("places").select("id, name").eq("id", approvedPlaceId);
    expect(error).toBeNull();
    expect(data).toEqual([{ id: approvedPlaceId, name: "Test Dublin" }]);
  });

  it("clients cannot write places", async () => {
    const insert = await alice.client.from("places").insert({ name: "Sneaky", precision: "city" });
    expect(insert.error?.code).toBe("42501");

    const update = await anon
      .from("places")
      .update({ name: "Renamed" })
      .eq("id", approvedPlaceId)
      .select("id");
    expect(update.error?.code).toBe("42501");
  });

  // Phase 4 made pending suggestions public so other readers can confirm them;
  // rejected ones stay visible only to their suggester (see tests/integration/locations.test.ts).
  it("anon sees approved and pending links", async () => {
    const { data, error } = await anon
      .from("book_places")
      .select("place_id, status")
      .eq("book_id", bookId)
      .order("status");
    expect(error).toBeNull();
    expect(data).toEqual([
      { place_id: approvedPlaceId, status: "approved" },
      { place_id: pendingPlaceId, status: "pending" },
    ]);
  });

  it("other users see pending suggestions too, but maps only use approved links", async () => {
    const other = await bob.client.from("book_places").select("place_id").eq("book_id", bookId);
    expect(other.data?.map((row) => row.place_id).sort()).toEqual(
      [approvedPlaceId, pendingPlaceId].sort(),
    );
    const { data: coords } = await bob.client.rpc("book_place_coords", { p_book_ids: [bookId] });
    expect(coords?.map((row) => row.place_id)).toEqual([approvedPlaceId]);
  });

  it("clients cannot insert or approve links directly", async () => {
    const insert = await alice.client
      .from("book_places")
      .insert({ book_id: bookId, place_id: approvedPlaceId, source: "user", created_by: alice.id });
    expect(insert.error?.code).toBe("42501");

    const approve = await alice.client
      .from("book_places")
      .update({ status: "approved" })
      .eq("place_id", pendingPlaceId)
      .select("id");
    expect(approve.error?.code).toBe("42501");
  });

  it("book_place_coords returns approved places with lng/lat, even to the suggester", async () => {
    for (const client of [anon, alice.client]) {
      const { data, error } = await client.rpc("book_place_coords", { p_book_ids: [bookId] });
      expect(error).toBeNull();
      expect(data).toEqual([
        {
          book_id: bookId,
          place_id: approvedPlaceId,
          name: "Test Dublin",
          precision: "city",
          country_code: "IE",
          source: "wikidata",
          lng: -6.26,
          lat: 53.35,
        },
      ]);
    }
  });
});

describe("ensureBookSettings (Wikidata cache write path)", () => {
  const admin = adminClient();
  const bookQid = fakeQid();
  const cityQid = fakeQid();
  const fictionalQid = fakeQid();
  let bookId: string;

  const fakePlaces: WikidataPlace[] = [
    {
      wikidataId: cityQid,
      name: "Fake City",
      precision: "city",
      countryCode: "IE",
      coordinates: [-6.2, 53.3],
    },
    {
      wikidataId: fictionalQid,
      name: "Fake Fictional Town",
      precision: "fictional",
      countryCode: null,
      coordinates: null,
    },
  ];
  let lookups = 0;
  const wikidata: WikidataClient = {
    findBookId: async () => {
      lookups++;
      return bookQid;
    },
    getNarrativeLocations: async () => fakePlaces,
  };

  beforeAll(async () => {
    const { data, error } = await admin
      .from("books")
      .insert({
        ol_work_id: `OL${Date.now()}8W`,
        title: "Settings Test Book",
        authors: ["A. Writer"],
      })
      .select("id, ol_work_id, wikidata_id, title, authors, setting_checked_at")
      .single();
    expect(error).toBeNull();
    bookId = data!.id;

    expect(await ensureBookSettings(admin, data!, wikidata)).toBe(true);
  });

  afterAll(async () => {
    if (bookId) await admin.from("books").delete().eq("id", bookId);
    await admin.from("places").delete().in("wikidata_id", [cityQid, fictionalQid]);
  });

  it("stores the QID, places and approved wikidata links, and marks the book checked", async () => {
    const { data: book } = await admin
      .from("books")
      .select("id, ol_work_id, wikidata_id, title, authors, setting_checked_at")
      .eq("id", bookId)
      .single();
    expect(book!.wikidata_id).toBe(bookQid);
    expect(book!.setting_checked_at).not.toBeNull();

    const { data: coords } = await admin.rpc("book_place_coords", { p_book_ids: [bookId] });
    expect(coords?.map((c) => [c.name, c.precision, c.source, c.lng, c.lat])).toEqual([
      ["Fake City", "city", "wikidata", -6.2, 53.3],
      ["Fake Fictional Town", "fictional", "wikidata", null, null],
    ]);

    // Fresh check: no second lookup within 90 days.
    expect(await ensureBookSettings(admin, book!, wikidata)).toBe(false);
    expect(lookups).toBe(1);
  });

  it("re-running a stale check is idempotent (places upsert on wikidata_id)", async () => {
    const { data: book } = await admin
      .from("books")
      .select("id, ol_work_id, wikidata_id, title, authors, setting_checked_at")
      .eq("id", bookId)
      .single();
    expect(await ensureBookSettings(admin, { ...book!, setting_checked_at: null }, wikidata)).toBe(
      true,
    );

    const { count: placeCount } = await admin
      .from("places")
      .select("id", { count: "exact", head: true })
      .in("wikidata_id", [cityQid, fictionalQid]);
    expect(placeCount).toBe(2);
    const { count: linkCount } = await admin
      .from("book_places")
      .select("id", { count: "exact", head: true })
      .eq("book_id", bookId);
    expect(linkCount).toBe(2);
  });

  it("a QID owned by another book doesn't block marking this one checked", async () => {
    const { data: twin } = await admin
      .from("books")
      .insert({ ol_work_id: `OL${randomUUID().replace(/\D/g, "").slice(0, 9)}7W`, title: "Twin" })
      .select("id, ol_work_id, wikidata_id, title, authors, setting_checked_at")
      .single();
    try {
      expect(await ensureBookSettings(admin, twin!, wikidata)).toBe(true);
      const { data } = await admin
        .from("books")
        .select("wikidata_id, setting_checked_at")
        .eq("id", twin!.id)
        .single();
      expect(data!.wikidata_id).toBeNull();
      expect(data!.setting_checked_at).not.toBeNull();
    } finally {
      await admin.from("books").delete().eq("id", twin!.id);
    }
  });
});
