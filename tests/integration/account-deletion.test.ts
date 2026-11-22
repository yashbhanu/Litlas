import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, createTestUser, uniqueUsername, type TestUser } from "./supabase";

/**
 * Phase 5: deleting an account (auth user, as DELETE /api/me does with the service role)
 * removes the profile, shelf entries, votes and rate-limit counters. Suggestions stay,
 * without the suggester.
 */
describe("account deletion", () => {
  const admin = adminClient();
  const tag = randomUUID().slice(0, 8);
  let reader: TestUser;
  let other: TestUser;
  let bookId = "";
  let placeId = "";
  let suggestionId = "";
  let othersSuggestionId = "";

  beforeAll(async () => {
    [reader, other] = await Promise.all([
      createTestUser(admin, "leaver"),
      createTestUser(admin, "stayer"),
    ]);
    for (const user of [reader, other]) {
      await user.client.from("profiles").insert({ id: user.id, username: uniqueUsername("d") });
    }
    const { data: book } = await admin
      .from("books")
      .insert({ title: `Deletion ${tag}` })
      .select("id")
      .single();
    bookId = book!.id;
    const { data: places } = await admin
      .from("places")
      .insert([
        { name: `Mine ${tag}`, precision: "fictional" },
        { name: `Theirs ${tag}`, precision: "fictional" },
      ])
      .select("id");
    placeId = places![0]!.id;

    await reader.client
      .from("shelf_entries")
      .insert({ user_id: reader.id, book_id: bookId, status: "read" });
    const { data: links } = await admin
      .from("book_places")
      .insert([
        {
          book_id: bookId,
          place_id: placeId,
          source: "user",
          status: "pending",
          created_by: reader.id,
        },
        {
          book_id: bookId,
          place_id: places![1]!.id,
          source: "user",
          status: "pending",
          created_by: other.id,
        },
      ])
      .select("id, created_by");
    suggestionId = links!.find((l) => l.created_by === reader.id)!.id;
    othersSuggestionId = links!.find((l) => l.created_by === other.id)!.id;
    // The reader confirms the other user's suggestion and uses a rate limit.
    await reader.client
      .from("location_votes")
      .insert({ book_place_id: othersSuggestionId, user_id: reader.id });
    await reader.client.rpc("consume_rate_limit", { p_action: "suggest_location", p_max: 30 });
  });

  afterAll(async () => {
    await admin.auth.admin.deleteUser(other.id);
    await admin.from("books").delete().eq("id", bookId);
    await admin.from("places").delete().ilike("name", `%${tag}`);
  });

  it("removes the profile, shelf entries, votes and rate limits; keeps suggestions anonymously", async () => {
    const count = async (
      table: "profiles" | "shelf_entries" | "location_votes" | "rate_limits",
      column: string,
    ) =>
      (await admin.from(table).select("*", { count: "exact", head: true }).eq(column, reader.id))
        .count;

    expect(await count("profiles", "id")).toBe(1);
    expect(await count("shelf_entries", "user_id")).toBe(1);
    expect(await count("location_votes", "user_id")).toBe(1);
    expect(await count("rate_limits", "user_id")).toBe(1);

    const { error } = await admin.auth.admin.deleteUser(reader.id);
    expect(error).toBeNull();

    expect(await count("profiles", "id")).toBe(0);
    expect(await count("shelf_entries", "user_id")).toBe(0);
    expect(await count("location_votes", "user_id")).toBe(0);
    expect(await count("rate_limits", "user_id")).toBe(0);

    const { data: suggestion } = await admin
      .from("book_places")
      .select("created_by, status")
      .eq("id", suggestionId)
      .single();
    expect(suggestion).toEqual({ created_by: null, status: "pending" });
    // Other readers' data is untouched.
    expect(
      (await admin.from("book_places").select("created_by").eq("id", othersSuggestionId).single())
        .data?.created_by,
    ).toBe(other.id);
  });
});
