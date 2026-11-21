import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  adminClient,
  anonClient,
  createTestUser,
  uniqueUsername,
  type Client,
  type TestUser,
} from "./supabase";

/**
 * Row Level Security for profiles, books and shelf_entries (Phase 1).
 *
 * alice: public profile, one shelf entry
 * bob:   private profile, one shelf entry
 * carol: signed in, looks at the others
 */
describe("RLS: profiles, books, shelf_entries", () => {
  const admin = adminClient();
  const anon: Client = anonClient();
  let alice: TestUser;
  let bob: TestUser;
  let carol: TestUser;
  let bookId: string;
  let otherBookId: string;
  let aliceEntryId: string;
  let bobEntryId: string;

  beforeAll(async () => {
    [alice, bob, carol] = await Promise.all([
      createTestUser(admin, "alice"),
      createTestUser(admin, "bob"),
      createTestUser(admin, "carol"),
    ]);

    // Users create their own profiles through RLS, as onboarding does.
    for (const [user, isPublic] of [
      [alice, true],
      [bob, false],
      [carol, true],
    ] as const) {
      const { error } = await user.client
        .from("profiles")
        .insert({ id: user.id, username: uniqueUsername("u"), is_public: isPublic });
      expect(error).toBeNull();
    }

    // Books are written by the server with the service role.
    const { data: books, error } = await admin
      .from("books")
      .insert([
        { ol_work_id: `OL${Date.now()}1W`, title: "Test Book One" },
        { ol_work_id: `OL${Date.now()}2W`, title: "Test Book Two" },
      ])
      .select("id");
    expect(error).toBeNull();
    [bookId, otherBookId] = books!.map((b) => b.id) as [string, string];

    const insertEntry = async (user: TestUser) => {
      const { data, error } = await user.client
        .from("shelf_entries")
        .insert({ user_id: user.id, book_id: bookId, status: "read" })
        .select("id")
        .single();
      expect(error).toBeNull();
      return data!.id;
    };
    aliceEntryId = await insertEntry(alice);
    bobEntryId = await insertEntry(bob);
  });

  afterAll(async () => {
    // Deleting auth users cascades to profiles and shelf entries.
    await Promise.all(
      [alice, bob, carol].filter(Boolean).map((u) => admin.auth.admin.deleteUser(u.id)),
    );
    if (bookId) await admin.from("books").delete().in("id", [bookId, otherBookId]);
  });

  describe("shelf_entries", () => {
    it("blocks other signed-in users from reading a private shelf", async () => {
      const { data, error } = await carol.client
        .from("shelf_entries")
        .select("id")
        .eq("user_id", bob.id);
      expect(error).toBeNull();
      expect(data).toEqual([]);
    });

    it("blocks anonymous visitors from reading a private shelf", async () => {
      const { data, error } = await anon.from("shelf_entries").select("id").eq("user_id", bob.id);
      expect(error).toBeNull();
      expect(data).toEqual([]);
    });

    it("lets the owner read their own private shelf", async () => {
      const { data } = await bob.client.from("shelf_entries").select("id").eq("user_id", bob.id);
      expect(data).toEqual([{ id: bobEntryId }]);
    });

    it("lets anyone read a public profile's shelf", async () => {
      const { data: asCarol } = await carol.client
        .from("shelf_entries")
        .select("id")
        .eq("user_id", alice.id);
      const { data: asAnon } = await anon
        .from("shelf_entries")
        .select("id")
        .eq("user_id", alice.id);
      expect(asCarol).toEqual([{ id: aliceEntryId }]);
      expect(asAnon).toEqual([{ id: aliceEntryId }]);
    });

    it("hides a shelf as soon as its profile goes private", async () => {
      const { error } = await alice.client
        .from("profiles")
        .update({ is_public: false })
        .eq("id", alice.id);
      expect(error).toBeNull();
      const { data } = await carol.client
        .from("shelf_entries")
        .select("id")
        .eq("user_id", alice.id);
      expect(data).toEqual([]);
      await alice.client.from("profiles").update({ is_public: true }).eq("id", alice.id);
    });

    it("blocks adding entries to someone else's shelf", async () => {
      const { error } = await carol.client
        .from("shelf_entries")
        .insert({ user_id: alice.id, book_id: otherBookId, status: "want" });
      expect(error?.code).toBe("42501"); // insufficient_privilege (RLS)
    });

    it("blocks updating or deleting someone else's entries", async () => {
      const { data: updated } = await carol.client
        .from("shelf_entries")
        .update({ status: "want" })
        .eq("id", aliceEntryId)
        .select("id");
      const { data: deleted } = await carol.client
        .from("shelf_entries")
        .delete()
        .eq("id", aliceEntryId)
        .select("id");
      expect(updated).toEqual([]);
      expect(deleted).toEqual([]);

      const { data: still } = await admin
        .from("shelf_entries")
        .select("status")
        .eq("id", aliceEntryId)
        .single();
      expect(still?.status).toBe("read");
    });

    it("blocks anonymous writes", async () => {
      const { error } = await anon
        .from("shelf_entries")
        .insert({ user_id: alice.id, book_id: otherBookId, status: "want" });
      expect(error).not.toBeNull();
    });

    it("lets owners update and delete their own entries", async () => {
      const { data: inserted } = await carol.client
        .from("shelf_entries")
        .insert({ user_id: carol.id, book_id: otherBookId, status: "want" })
        .select("id")
        .single();
      const { data: updated } = await carol.client
        .from("shelf_entries")
        .update({ status: "reading" })
        .eq("id", inserted!.id)
        .select("status");
      expect(updated).toEqual([{ status: "reading" }]);
      const { data: deleted } = await carol.client
        .from("shelf_entries")
        .delete()
        .eq("id", inserted!.id)
        .select("id");
      expect(deleted).toEqual([{ id: inserted!.id }]);
    });
  });

  describe("profiles", () => {
    it("exposes public columns to everyone, including private profiles' usernames", async () => {
      const { data, error } = await anon
        .from("profiles")
        .select("id, username, display_name, is_public")
        .eq("id", bob.id)
        .single();
      expect(error).toBeNull();
      expect(data).toMatchObject({ id: bob.id, is_public: false });
    });

    it("never exposes is_admin to clients", async () => {
      const { error: anonError } = await anon.from("profiles").select("is_admin").limit(1);
      const { error: ownError } = await alice.client
        .from("profiles")
        .select("is_admin")
        .eq("id", alice.id);
      expect(anonError?.code).toBe("42501");
      expect(ownError?.code).toBe("42501");
    });

    it("blocks users from making themselves admin", async () => {
      const { error } = await alice.client
        .from("profiles")
        .update({ is_admin: true })
        .eq("id", alice.id);
      expect(error?.code).toBe("42501");
    });

    it("blocks creating a profile for someone else", async () => {
      const mallory = await createTestUser(admin, "mallory");
      try {
        const { error } = await mallory.client
          .from("profiles")
          .insert({ id: randomUUID(), username: uniqueUsername("m") });
        expect(error).not.toBeNull();
      } finally {
        await admin.auth.admin.deleteUser(mallory.id);
      }
    });

    it("blocks editing someone else's profile", async () => {
      const { data } = await carol.client
        .from("profiles")
        .update({ display_name: "hacked" })
        .eq("id", alice.id)
        .select("id");
      expect(data).toEqual([]);
    });

    it("enforces unique, well-formed usernames", async () => {
      const { data: aliceProfile } = await admin
        .from("profiles")
        .select("username")
        .eq("id", alice.id)
        .single();
      const { error: taken } = await carol.client
        .from("profiles")
        .update({ username: aliceProfile!.username })
        .eq("id", carol.id);
      const { error: malformed } = await carol.client
        .from("profiles")
        .update({ username: "Bad Name!" })
        .eq("id", carol.id);
      expect(taken?.code).toBe("23505");
      expect(malformed?.code).toBe("23514");
    });
  });

  describe("books", () => {
    it("is publicly readable", async () => {
      const { data } = await anon.from("books").select("id, title").eq("id", bookId).single();
      expect(data?.title).toBe("Test Book One");
    });

    it("cannot be written by clients", async () => {
      const { error: insertError } = await alice.client
        .from("books")
        .insert({ title: "Sneaky", ol_work_id: `OL${Date.now()}9W` });
      const { error: updateError } = await alice.client
        .from("books")
        .update({ title: "Changed" })
        .eq("id", bookId);
      expect(insertError?.code).toBe("42501");
      expect(updateError?.code).toBe("42501");
    });
  });
});
