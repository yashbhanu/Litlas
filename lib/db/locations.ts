import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { isPostgrestError, PG } from "@/lib/api";
import { countryName } from "@/lib/geo/continents";
import { APPROVAL_THRESHOLD } from "@/lib/locations/constants";
import type { PendingSuggestion } from "@/lib/locations/types";
import type { SuggestLocation } from "@/lib/validation/locations";
import type { Database } from "./database.types";

type Client = SupabaseClient<Database>;
type Suggestion = SuggestLocation;

/** Typed outcome of a suggestion or vote, mapped to API errors by the routes. */
export type LocationError =
  "not_found" | "own_suggestion" | "already_voted" | "not_pending" | "rejected";

export class LocationActionError extends Error {
  constructor(readonly reason: LocationError) {
    super(reason);
  }
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/** A book's pending suggestions with vote counts and the caller's own state. */
export async function listPendingSuggestions(
  supabase: Client,
  bookId: string,
): Promise<PendingSuggestion[]> {
  const { data, error } = await supabase.rpc("pending_suggestions", { p_book_id: bookId });
  if (error) throw error;
  return data.map((row) => ({
    bookPlaceId: row.book_place_id,
    placeId: row.place_id,
    name: row.name,
    precision: row.precision,
    countryCode: (row.country_code as string | null) ?? null,
    createdAt: row.created_at,
    votes: row.votes,
    mine: row.mine,
    voted: row.voted,
  }));
}

// ---------------------------------------------------------------------------
// Suggest
// ---------------------------------------------------------------------------

/**
 * Find the place a suggestion refers to, or create it (service role). Reuses existing
 * rows so suggestions converge: a country by its ISO code (preferring the Wikidata
 * row), a real place by OSM id and precision, a fictional place by name.
 */
async function findOrCreatePlace(admin: Client, input: Suggestion): Promise<string> {
  let query = admin.from("places").select("id").limit(1);
  if (input.precision === "country") {
    query = query.eq("precision", "country").eq("country_code", input.countryCode!);
  } else if (input.precision === "fictional") {
    query = query.eq("precision", "fictional").ilike("name", input.name.replace(/[\\%_]/g, "\\$&"));
  } else {
    query = query.eq("precision", input.precision).eq("osm_id", input.osmId);
  }
  const { data: existing, error } = await query.order("wikidata_id", { nullsFirst: false });
  if (error) throw error;
  if (existing[0]) return existing[0].id;

  const row: Database["public"]["Tables"]["places"]["Insert"] =
    input.precision === "country"
      ? {
          name: countryName(input.countryCode!),
          precision: "country" as const,
          country_code: input.countryCode!,
        }
      : input.precision === "fictional"
        ? { name: input.name, precision: "fictional" as const }
        : {
            name: input.name,
            precision: input.precision,
            osm_id: input.osmId,
            country_code: input.countryCode ?? null,
            geom: `SRID=4326;POINT(${input.lng} ${input.lat})`,
          };
  const { data, error: insertError } = await admin.from("places").insert(row).select("id").single();
  if (insertError) throw insertError;
  return data.id;
}

/**
 * Suggest a location for a book:
 * - a new place/link is created as pending (source user) with the suggester's vote;
 * - an existing pending suggestion by someone else counts as a vote for it;
 * - an approved link is left alone; a rejected one can't be re-suggested.
 * Returns the link id and its status.
 */
export async function suggestLocation(
  admin: Client,
  supabase: Client,
  { bookId, userId, input }: { bookId: string; userId: string; input: Suggestion },
): Promise<{ bookPlaceId: string; status: "pending" | "approved" }> {
  const placeId = await findOrCreatePlace(admin, input);

  const { data: link, error } = await admin
    .from("book_places")
    .select("id, status, created_by")
    .eq("book_id", bookId)
    .eq("place_id", placeId)
    .maybeSingle();
  if (error) throw error;

  if (link?.status === "approved") return { bookPlaceId: link.id, status: "approved" };
  if (link?.status === "rejected") throw new LocationActionError("rejected");
  if (link) {
    if (link.created_by === userId) return { bookPlaceId: link.id, status: "pending" };
    try {
      return { bookPlaceId: link.id, ...(await voteForLocation(supabase, link.id, userId)) };
    } catch (voteError) {
      if (voteError instanceof LocationActionError && voteError.reason === "already_voted") {
        return { bookPlaceId: link.id, status: "pending" };
      }
      throw voteError;
    }
  }

  const { data: created, error: insertError } = await admin
    .from("book_places")
    .insert({
      book_id: bookId,
      place_id: placeId,
      source: "user",
      status: "pending",
      created_by: userId,
    })
    .select("id")
    .single();
  if (insertError) throw insertError;
  // The suggester's own vote, recorded by the server: RLS stops users voting on their
  // own suggestions directly. The approval trigger runs on this insert too.
  const { error: voteError } = await admin
    .from("location_votes")
    .insert({ book_place_id: created.id, user_id: userId });
  if (voteError) throw voteError;
  const status = await linkStatus(admin, created.id);
  return { bookPlaceId: created.id, status: status === "approved" ? "approved" : "pending" };
}

async function linkStatus(client: Client, bookPlaceId: string) {
  const { data, error } = await client
    .from("book_places")
    .select("status")
    .eq("id", bookPlaceId)
    .maybeSingle();
  if (error) throw error;
  return data?.status ?? null;
}

// ---------------------------------------------------------------------------
// Vote
// ---------------------------------------------------------------------------

/**
 * Confirm someone else's pending suggestion, as the signed-in user (RLS enforces the
 * rules; the trigger approves at the threshold). Returns the new status and votes.
 */
export async function voteForLocation(
  supabase: Client,
  bookPlaceId: string,
  userId: string,
): Promise<{ status: "pending" | "approved"; votes: number }> {
  const { data: link, error } = await supabase
    .from("book_places")
    .select("book_id, status, created_by")
    .eq("id", bookPlaceId)
    .maybeSingle();
  if (error) throw error;
  if (!link) throw new LocationActionError("not_found");
  if (link.created_by === userId) throw new LocationActionError("own_suggestion");
  if (link.status !== "pending") throw new LocationActionError("not_pending");

  const { error: voteError } = await supabase
    .from("location_votes")
    .insert({ book_place_id: bookPlaceId, user_id: userId });
  if (voteError) {
    if (isPostgrestError(voteError) && voteError.code === PG.uniqueViolation) {
      throw new LocationActionError("already_voted");
    }
    if (isPostgrestError(voteError) && voteError.code === PG.insufficientPrivilege) {
      throw new LocationActionError("not_pending");
    }
    throw voteError;
  }

  const status = await linkStatus(supabase, bookPlaceId);
  if (status === "approved") return { status, votes: APPROVAL_THRESHOLD };
  const pending = await listPendingSuggestions(supabase, link.book_id);
  return {
    status: "pending",
    votes: pending.find((s) => s.bookPlaceId === bookPlaceId)?.votes ?? 0,
  };
}

/** Withdraw the user's vote on a pending suggestion. Returns false if there was none. */
export async function withdrawVote(supabase: Client, bookPlaceId: string, userId: string) {
  const { data, error } = await supabase
    .from("location_votes")
    .delete()
    .eq("book_place_id", bookPlaceId)
    .eq("user_id", userId)
    .select("book_place_id");
  if (error) throw error;
  return data.length > 0;
}

// ---------------------------------------------------------------------------
// Moderation (service role)
// ---------------------------------------------------------------------------

export async function isAdmin(admin: Client, userId: string): Promise<boolean> {
  const { data, error } = await admin
    .from("profiles")
    .select("is_admin")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data?.is_admin ?? false;
}

/** Approve or reject a link. Returns its book id, or null if it doesn't exist. */
export async function setLinkStatus(
  admin: Client,
  bookPlaceId: string,
  status: "approved" | "rejected",
) {
  const { data, error } = await admin
    .from("book_places")
    .update({ status })
    .eq("id", bookPlaceId)
    .select("book_id")
    .maybeSingle();
  if (error) throw error;
  return data?.book_id ?? null;
}

/** Merge the link's place into another place. Returns the book id, or null if missing. */
export async function mergeLinkPlace(admin: Client, bookPlaceId: string, intoPlaceId: string) {
  const { data: link, error } = await admin
    .from("book_places")
    .select("book_id, place_id")
    .eq("id", bookPlaceId)
    .maybeSingle();
  if (error) throw error;
  if (!link) return null;
  if (link.place_id === intoPlaceId) throw new LocationActionError("not_pending");
  const { error: mergeError } = await admin.rpc("merge_places", {
    p_from: link.place_id,
    p_into: intoPlaceId,
  });
  if (mergeError) throw mergeError;
  return link.book_id;
}

export interface ModerationItem {
  bookPlaceId: string;
  bookId: string;
  bookTitle: string;
  placeId: string;
  placeName: string;
  precision: Database["public"]["Enums"]["location_precision"];
  countryCode: string | null;
  suggestedBy: string | null;
  createdAt: string;
  votes: number;
  duplicates: {
    id: string;
    name: string;
    precision: Database["public"]["Enums"]["location_precision"];
    countryCode: string | null;
    source: string;
    links: number;
  }[];
}

export async function loadModerationQueue(admin: Client): Promise<ModerationItem[]> {
  const { data, error } = await admin.rpc("moderation_queue", { p_limit: 50 });
  if (error) throw error;
  return Promise.all(
    data.map(async (row) => {
      const { data: dupes, error: dupError } = await admin.rpc("place_duplicates", {
        p_place_id: row.place_id,
      });
      if (dupError) throw dupError;
      return {
        bookPlaceId: row.book_place_id,
        bookId: row.book_id,
        bookTitle: row.book_title,
        placeId: row.place_id,
        placeName: row.place_name,
        precision: row.precision,
        countryCode: (row.country_code as string | null) ?? null,
        suggestedBy: (row.suggested_by as string | null) ?? null,
        createdAt: row.created_at,
        votes: row.votes,
        duplicates: dupes.map((d) => ({
          id: d.id,
          name: d.name,
          precision: d.precision,
          countryCode: (d.country_code as string | null) ?? null,
          source: d.source,
          links: d.links,
        })),
      };
    }),
  );
}
