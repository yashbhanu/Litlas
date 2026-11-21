import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, anonClient } from "./supabase";

/**
 * Explore SQL functions (Phase 3), run as a signed-out visitor. Test places sit on a
 * remote patch of the South Pacific so real/seeded data doesn't interfere.
 */
describe("explore functions", () => {
  const admin = adminClient();
  const anon = anonClient();
  const tag = randomUUID().slice(0, 8);
  const ids = { books: [] as string[], places: {} as Record<string, string> };

  beforeAll(async () => {
    const { data: books, error: bookError } = await admin
      .from("books")
      .insert(
        Array.from({ length: 25 }, (_, i) => ({
          title: `Explore ${tag} ${String(i).padStart(2, "0")}`,
        })),
      )
      .select("id");
    expect(bookError).toBeNull();
    ids.books = books!.map((b) => b.id);

    const { data: places, error: placeError } = await admin
      .from("places")
      .insert([
        {
          name: `Inside ${tag}`,
          precision: "city",
          country_code: "PN",
          geom: "SRID=4326;POINT(-130.1 -25.1)",
        },
        {
          name: `Second ${tag}`,
          precision: "point",
          country_code: "PN",
          geom: "SRID=4326;POINT(-130.2 -25.2)",
        },
        {
          name: `Outside ${tag}`,
          precision: "city",
          country_code: "PN",
          geom: "SRID=4326;POINT(-128.0 -23.0)",
        },
        {
          name: `Pending ${tag}`,
          precision: "city",
          country_code: "PN",
          geom: "SRID=4326;POINT(-130.3 -25.3)",
        },
        {
          name: `Area ${tag}`,
          precision: "region",
          country_code: "PN",
          geom: "SRID=4326;POINT(-130.4 -25.4)",
        },
        { name: `Fictional ${tag}`, precision: "fictional" },
      ])
      .select("id, name");
    expect(placeError).toBeNull();
    for (const p of places!) ids.places[p.name.split(" ")[0]!] = p.id;

    const link = (book: string, place: string, status: "approved" | "pending" = "approved") => ({
      book_id: book,
      place_id: place,
      source: "admin" as const,
      status,
    });
    const { error: linkError } = await admin.from("book_places").insert([
      // 25 books at "Inside", 1 at "Second".
      ...ids.books.map((b) => link(b, ids.places.Inside!)),
      link(ids.books[0]!, ids.places.Second!),
      link(ids.books[1]!, ids.places.Outside!),
      link(ids.books[2]!, ids.places.Pending!, "pending"),
      link(ids.books[3]!, ids.places.Area!),
      link(ids.books[4]!, ids.places.Fictional!),
    ]);
    expect(linkError).toBeNull();
  });

  afterAll(async () => {
    await admin.from("books").delete().in("id", ids.books);
    await admin.from("places").delete().in("id", Object.values(ids.places));
  });

  const box = { min_lng: -131, min_lat: -26, max_lng: -129.5, max_lat: -24.5 };

  it("explore_places returns approved pins inside the box only, most-read first", async () => {
    const { data, error } = await anon.rpc("explore_places", box);
    expect(error).toBeNull();
    const ours = data!.filter((row) => row.name.endsWith(tag));
    expect(ours.map((row) => [row.name, row.book_count])).toEqual([
      [`Inside ${tag}`, 25],
      [`Second ${tag}`, 1],
    ]);
    expect(ours[0]).toMatchObject({ country_code: "PN", lng: -130.1, lat: -25.1 });
  });

  it("explore_places honours the feature cap", async () => {
    const { data } = await anon.rpc("explore_places", { ...box, max_features: 1 });
    expect(data).toHaveLength(1);
    const { data: capped } = await anon.rpc("explore_places", { ...box, max_features: 100_000 });
    expect(capped!.length).toBeLessThanOrEqual(2000);
  });

  it("books_at_place paginates with a total", async () => {
    const page1 = await anon.rpc("books_at_place", {
      p_place_id: ids.places.Inside!,
      p_limit: 20,
      p_offset: 0,
    });
    const page2 = await anon.rpc("books_at_place", {
      p_place_id: ids.places.Inside!,
      p_limit: 20,
      p_offset: 20,
    });
    expect(page1.data).toHaveLength(20);
    expect(page2.data).toHaveLength(5);
    expect(Number(page1.data![0]!.total)).toBe(25);
    expect(page1.data![0]!.title).toBe(`Explore ${tag} 00`);
    const pending = await anon.rpc("books_at_place", { p_place_id: ids.places.Pending! });
    expect(pending.data).toEqual([]);
  });

  it("books_in_country counts each book once, ignoring fictional and pending links", async () => {
    const { data } = await anon.rpc("books_in_country", { p_country_code: "pn", p_limit: 100 });
    const ours = data!.filter((row) => row.title.includes(tag));
    // All 25 books are at "Inside"; the pending and fictional links add nothing.
    expect(ours).toHaveLength(25);
    expect(new Set(ours.map((row) => row.id)).size).toBe(25);
  });

  it("search_places matches names, skips fictional places, and escapes wildcards", async () => {
    const { data } = await anon.rpc("search_places", { q: `inside ${tag}` });
    expect(data?.map((row) => row.name)).toEqual([`Inside ${tag}`]);
    expect((await anon.rpc("search_places", { q: `Fictional ${tag}` })).data).toEqual([]);
    expect((await anon.rpc("search_places", { q: `%${tag}` })).data).toEqual([]);
  });

  it("place_detail returns coordinates", async () => {
    const { data } = await anon.rpc("place_detail", { p_place_id: ids.places.Second! });
    expect(data).toEqual([
      expect.objectContaining({
        name: `Second ${tag}`,
        precision: "point",
        lng: -130.2,
        lat: -25.2,
      }),
    ]);
  });
});
