import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { isPostgrestError, PG } from "@/lib/api";
import type { WikidataClient, WikidataPlace } from "@/lib/external/wikidata";
import type { Database } from "./database.types";

type AdminClient = SupabaseClient<Database>;

/** Re-check a book's setting on Wikidata after this long. */
export const SETTING_RECHECK_MS = 90 * 24 * 60 * 60 * 1000;

export function isSettingStale(checkedAt: string | null, now = Date.now()): boolean {
  if (!checkedAt) return true;
  const time = Date.parse(checkedAt);
  return Number.isNaN(time) || now - time >= SETTING_RECHECK_MS;
}

export interface BookForSettings {
  id: string;
  ol_work_id: string | null;
  wikidata_id: string | null;
  title: string;
  authors: string[];
  setting_checked_at: string | null;
}

function toEwkt([lng, lat]: [number, number]): string {
  return `SRID=4326;POINT(${lng} ${lat})`;
}

async function upsertWikidataPlaces(admin: AdminClient, places: WikidataPlace[]) {
  const { data, error } = await admin
    .from("places")
    .upsert(
      places.map((place) => ({
        wikidata_id: place.wikidataId,
        name: place.name,
        precision: place.precision,
        country_code: place.countryCode,
        geom: place.coordinates ? toEwkt(place.coordinates) : null,
      })),
      { onConflict: "wikidata_id" },
    )
    .select("id");
  if (error) throw error;
  return data.map((row) => row.id);
}

/**
 * Look up a book's setting on Wikidata if it was never checked or the check is older
 * than 90 days: resolve its QID, upsert its narrative locations into `places`, and link
 * them as approved `book_places` (source wikidata). Existing links are never removed.
 * Writes use the service role. External errors propagate; `setting_checked_at` is only
 * set after a successful lookup, so a failed one is retried next time.
 *
 * Returns true if a lookup ran.
 */
export async function ensureBookSettings(
  admin: AdminClient,
  book: BookForSettings,
  wikidata: WikidataClient,
  now = Date.now(),
): Promise<boolean> {
  if (!isSettingStale(book.setting_checked_at, now)) return false;

  const qid =
    book.wikidata_id ??
    (await wikidata.findBookId({
      olWorkId: book.ol_work_id,
      title: book.title,
      authors: book.authors,
    }));
  const places = qid ? await wikidata.getNarrativeLocations(qid) : [];

  if (places.length > 0) {
    const placeIds = await upsertWikidataPlaces(admin, places);
    const { error } = await admin.from("book_places").upsert(
      placeIds.map((placeId) => ({
        book_id: book.id,
        place_id: placeId,
        source: "wikidata" as const,
        status: "approved" as const,
      })),
      { onConflict: "book_id,place_id" },
    );
    if (error) throw error;
  }

  const checkedAt = new Date(now).toISOString();
  const update = { setting_checked_at: checkedAt, wikidata_id: qid };
  let { error } = await admin.from("books").update(update).eq("id", book.id);
  if (error && isPostgrestError(error) && error.code === PG.uniqueViolation) {
    // Another book row (e.g. a different Open Library work) already owns this QID.
    ({ error } = await admin
      .from("books")
      .update({ setting_checked_at: checkedAt })
      .eq("id", book.id));
  }
  if (error) throw error;
  return true;
}
