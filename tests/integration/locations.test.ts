import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { APPROVAL_THRESHOLD, RATE_LIMITS } from "@/lib/locations/constants";
import { adminClient, anonClient, createTestUser, uniqueUsername, type TestUser } from "./supabase";

/**
 * Phase 4: suggestion visibility, voting rules, the approval function (trigger), rate
 * limits and place merging, against local Supabase.
 *
 * alice suggests; bob, carol and dave vote.
 */
describe("crowdsourced locations", () => {
  const admin = adminClient();
  const anon = anonClient();
  const tag = randomUUID().slice(0, 8);
  let alice: TestUser, bob: TestUser, carol: TestUser, dave: TestUser;
  let bookId = "";
  const placeIds: string[] = [];

  /** A pending suggestion by alice (with her own vote, as the API records it). */
  async function suggest(name: string) {
    const { data: place } = await admin
      .from("places")
      .insert({ name: `${name} ${tag}`, precision: "city", geom: "SRID=4326;POINT(10 10)" })
      .select("id")
      .single();
    placeIds.push(place!.id);
    const { data: link, error } = await admin
      .from("book_places")
      .insert({
        book_id: bookId,
        place_id: place!.id,
        source: "user",
        status: "pending",
        created_by: alice.id,
      })
      .select("id")
      .single();
    expect(error).toBeNull();
    await admin.from("location_votes").insert({ book_place_id: link!.id, user_id: alice.id });
    return { linkId: link!.id, placeId: place!.id };
  }

  const status = async (linkId: string) =>
    (await admin.from("book_places").select("status").eq("id", linkId).single()).data?.status;

  beforeAll(async () => {
    [alice, bob, carol, dave] = await Promise.all(
      ["alice", "bob", "carol", "dave"].map((label) => createTestUser(admin, label)),
    );
    for (const user of [alice, bob, carol, dave]) {
      const { error } = await user.client
        .from("profiles")
        .insert({ id: user.id, username: uniqueUsername("v") });
      expect(error).toBeNull();
    }
    const { data: book } = await admin
      .from("books")
      .insert({ title: `Votes ${tag}` })
      .select("id")
      .single();
    bookId = book!.id;
  });

  afterAll(async () => {
    await Promise.all(
      [alice, bob, carol, dave].filter(Boolean).map((u) => admin.auth.admin.deleteUser(u.id)),
    );
    if (bookId) await admin.from("books").delete().eq("id", bookId);
    if (placeIds.length) await admin.from("places").delete().in("id", placeIds);
  });

  it("the SQL threshold matches APPROVAL_THRESHOLD", async () => {
    const { data } = await anon.rpc("approval_threshold");
    expect(data).toBe(APPROVAL_THRESHOLD);
  });

  it("pending suggestions are visible to everyone; rejected ones only to the suggester", async () => {
    const { linkId } = await suggest("Visible");
    for (const client of [anon, bob.client]) {
      const { data } = await client.from("book_places").select("id, status").eq("id", linkId);
      expect(data).toEqual([{ id: linkId, status: "pending" }]);
    }
    await admin.from("book_places").update({ status: "rejected" }).eq("id", linkId);
    expect((await bob.client.from("book_places").select("id").eq("id", linkId)).data).toEqual([]);
    expect((await anon.from("book_places").select("id").eq("id", linkId)).data).toEqual([]);
    expect((await alice.client.from("book_places").select("id").eq("id", linkId)).data).toEqual([
      { id: linkId },
    ]);
  });

  it("3 votes (the suggester's + 2 others) approve a suggestion", async () => {
    const { linkId } = await suggest("Approved");
    expect(await status(linkId)).toBe("pending");

    expect(
      (await bob.client.from("location_votes").insert({ book_place_id: linkId, user_id: bob.id }))
        .error,
    ).toBeNull();
    expect(await status(linkId)).toBe("pending");

    const { data: counts } = await bob.client.rpc("pending_suggestions", { p_book_id: bookId });
    expect(counts?.find((s) => s.book_place_id === linkId)).toMatchObject({
      votes: 2,
      mine: false,
      voted: true,
    });
    const { data: mine } = await alice.client.rpc("pending_suggestions", { p_book_id: bookId });
    expect(mine?.find((s) => s.book_place_id === linkId)).toMatchObject({ mine: true });

    expect(
      (
        await carol.client
          .from("location_votes")
          .insert({ book_place_id: linkId, user_id: carol.id })
      ).error,
    ).toBeNull();
    expect(await status(linkId)).toBe("approved");

    // Approved: it's in the map data, and no longer open for votes.
    const { data: coords } = await anon.rpc("book_place_coords", { p_book_ids: [bookId] });
    expect(coords?.map((c) => c.name)).toContain(`Approved ${tag}`);
    const late = await dave.client
      .from("location_votes")
      .insert({ book_place_id: linkId, user_id: dave.id });
    expect(late.error?.code).toBe("42501");
  });

  it("users cannot vote twice, vote on their own suggestion, or vote as someone else", async () => {
    const { linkId } = await suggest("Rules");

    const own = await alice.client
      .from("location_votes")
      .insert({ book_place_id: linkId, user_id: alice.id });
    expect(own.error?.code).toBe("42501");

    expect(
      (await bob.client.from("location_votes").insert({ book_place_id: linkId, user_id: bob.id }))
        .error,
    ).toBeNull();
    const twice = await bob.client
      .from("location_votes")
      .insert({ book_place_id: linkId, user_id: bob.id });
    expect(twice.error?.code).toBe("23505");

    const impersonate = await bob.client
      .from("location_votes")
      .insert({ book_place_id: linkId, user_id: carol.id });
    expect(impersonate.error?.code).toBe("42501");

    const anonVote = await anon
      .from("location_votes")
      .insert({ book_place_id: linkId, user_id: bob.id });
    expect(anonVote.error).not.toBeNull();

    // Clients can't approve directly either.
    const direct = await bob.client
      .from("book_places")
      .update({ status: "approved" })
      .eq("id", linkId)
      .select("id");
    expect(direct.error?.code).toBe("42501");
    expect(await status(linkId)).toBe("pending");
  });

  it("votes can be withdrawn while pending; other users' votes are private", async () => {
    const { linkId } = await suggest("Withdraw");
    await dave.client.from("location_votes").insert({ book_place_id: linkId, user_id: dave.id });
    expect(
      (await bob.client.from("location_votes").select("user_id").eq("book_place_id", linkId)).data,
    ).toEqual([]);
    const { data } = await dave.client
      .from("location_votes")
      .delete()
      .eq("book_place_id", linkId)
      .eq("user_id", dave.id)
      .select("user_id");
    expect(data).toEqual([{ user_id: dave.id }]);
  });

  it("consume_rate_limit counts per user per day and enforces the limit", async () => {
    const max = 2;
    const results = [];
    for (let i = 0; i < 3; i++) {
      results.push(
        (
          await bob.client.rpc("consume_rate_limit", {
            p_action: `test_${tag.replace(/\d/g, "")}`,
            p_max: max,
          })
        ).data,
      );
    }
    expect(results).toEqual([true, true, false]);
    // Separate per user; anon is never allowed; the table itself is off limits.
    expect(
      (
        await carol.client.rpc("consume_rate_limit", {
          p_action: `test_${tag.replace(/\d/g, "")}`,
          p_max: max,
        })
      ).data,
    ).toBe(true);
    expect(
      (await anon.rpc("consume_rate_limit", { p_action: "suggest_location", p_max: 30 })).error,
    ).not.toBeNull();
    expect((await bob.client.from("rate_limits").select("count")).error?.code).toBe("42501");
    expect(RATE_LIMITS.suggest_location).toBe(30);
  });

  it("merge_places moves links and votes to the target, then deletes the duplicate", async () => {
    const { linkId: dupLink, placeId: dupPlace } = await suggest("Duplicate");
    await bob.client.from("location_votes").insert({ book_place_id: dupLink, user_id: bob.id });
    const { linkId: keepLink, placeId: keepPlace } = await suggest("Keeper");

    // Clients can't call it.
    expect(
      (await alice.client.rpc("merge_places", { p_from: dupPlace, p_into: keepPlace })).error,
    ).not.toBeNull();

    const { data: moved, error } = await admin.rpc("merge_places", {
      p_from: dupPlace,
      p_into: keepPlace,
    });
    expect(error).toBeNull();
    expect(moved).toBe(1);
    expect((await admin.from("places").select("id").eq("id", dupPlace)).data).toEqual([]);
    expect((await admin.from("book_places").select("id").eq("id", dupLink)).data).toEqual([]);
    // alice + bob's votes were combined onto the kept link (alice's counted once): 2 votes.
    const { count } = await admin
      .from("location_votes")
      .select("user_id", { count: "exact", head: true })
      .eq("book_place_id", keepLink);
    expect(count).toBe(2);

    // One more vote reaches the threshold.
    await carol.client
      .from("location_votes")
      .insert({ book_place_id: keepLink, user_id: carol.id });
    expect(await status(keepLink)).toBe("approved");
  });

  it("moderation functions are service-role only", async () => {
    expect((await bob.client.rpc("moderation_queue", {})).error).not.toBeNull();
    expect((await anon.rpc("place_duplicates", { p_place_id: placeIds[0]! })).error).not.toBeNull();
    const { data } = await admin.rpc("moderation_queue", {});
    expect(data?.some((row) => row.book_id === bookId)).toBe(true);
  });
});
