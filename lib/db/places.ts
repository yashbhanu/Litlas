import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { BookPlace } from "@/lib/geo/map";
import type { Database } from "./database.types";

type Client = SupabaseClient<Database>;

/**
 * Approved settings of the given books with plain coordinates. Runs as the caller, so
 * book_places RLS applies.
 */
export async function listBookPlaces(supabase: Client, bookIds: string[]): Promise<BookPlace[]> {
  if (bookIds.length === 0) return [];
  const { data, error } = await supabase.rpc("book_place_coords", { p_book_ids: bookIds });
  if (error) throw error;
  // The generated types mark every returned column non-null; area and fictional places
  // really have null coordinates (and fictional ones often no country).
  return data.map((row) => ({
    bookId: row.book_id,
    placeId: row.place_id,
    name: row.name,
    precision: row.precision,
    countryCode: (row.country_code as string | null) ?? null,
    source: row.source,
    lng: (row.lng as number | null) ?? null,
    lat: (row.lat as number | null) ?? null,
  }));
}
