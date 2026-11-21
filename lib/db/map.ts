import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ShelfEntryWithPlaces } from "@/lib/books/types";
import { buildUserMap, type UserMap } from "@/lib/geo/map";
import type { Database } from "./database.types";
import { listBookPlaces } from "./places";
import { listShelf } from "./shelf";

type Client = SupabaseClient<Database>;

export interface ShelfMap {
  entries: ShelfEntryWithPlaces[];
  map: UserMap;
}

/**
 * A user's shelf with each book's approved settings, plus their map. The map and stats
 * cover books marked "read". Runs as the caller, so RLS hides private shelves.
 */
export async function loadShelfMap(supabase: Client, userId: string): Promise<ShelfMap> {
  const shelf = await listShelf(supabase, userId);
  const places = await listBookPlaces(
    supabase,
    shelf.map((entry) => entry.book.id),
  );

  const entries = shelf.map((entry) => ({
    ...entry,
    places: places.filter((place) => place.bookId === entry.book.id),
  }));
  const readBooks = shelf
    .filter((entry) => entry.status === "read")
    .map(({ book }) => ({ id: book.id, title: book.title, authors: book.authors }));

  return { entries, map: buildUserMap(readBooks, places) };
}

export interface PublicProfile {
  id: string;
  username: string;
  displayName: string | null;
  isPublic: boolean;
}

/** Profile by username (public columns only), or null. */
export async function findProfileByUsername(
  supabase: Client,
  username: string,
): Promise<PublicProfile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, display_name, is_public")
    .eq("username", username)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    username: data.username,
    displayName: data.display_name,
    isPublic: data.is_public,
  };
}
