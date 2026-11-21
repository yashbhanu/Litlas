import "server-only";

import { createClient } from "@supabase/supabase-js";
import { cacheLife, cacheTag } from "next/cache";
import {
  BOOK_PAGE_SIZE,
  EXPLORE_MAX_FEATURES,
  type BookDetail,
  type BookListPage,
  type BookSummary,
  type ExploreResponse,
  type PlaceDetail,
  type PlaceSearchResult,
} from "@/lib/books/public-types";
import { getPublicEnv } from "@/lib/env";
import type { Bbox } from "@/lib/geo/bbox";
import type { Database } from "./database.types";
import { listBookPlaces } from "./places";

/**
 * Public, cached reads for Explore, place and book pages. They use a cookie-less anon
 * client (RLS as a signed-out visitor), so results are the same for everyone and can be
 * cached with `use cache`.
 *
 * Tags: BOOK_PLACES_TAG on everything that depends on book ↔ place links (revalidate
 * when links change), and `book:<id>` on one book's page.
 */
export const BOOK_PLACES_TAG = "book-places";
export const bookTag = (bookId: string) => `book:${bookId}`;

function anonClient() {
  const env = getPublicEnv();
  return createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

/** Approved pinnable places inside 1–2 normalized boxes, most-read first, capped. */
export async function explorePlaces(boxes: Bbox[]): Promise<ExploreResponse> {
  "use cache";
  cacheLife("hours");
  cacheTag(BOOK_PLACES_TAG);

  const supabase = anonClient();
  const results = await Promise.all(
    boxes.map(([minLng, minLat, maxLng, maxLat]) =>
      supabase.rpc("explore_places", {
        min_lng: minLng,
        min_lat: minLat,
        max_lng: maxLng,
        max_lat: maxLat,
        max_features: EXPLORE_MAX_FEATURES,
      }),
    ),
  );
  const rows = results.flatMap(({ data, error }) => {
    if (error) throw error;
    return data;
  });
  rows.sort((a, b) => b.book_count - a.book_count);
  const truncated =
    rows.length > EXPLORE_MAX_FEATURES ||
    results.some(({ data }) => (data?.length ?? 0) >= EXPLORE_MAX_FEATURES);

  return {
    type: "FeatureCollection",
    features: rows.slice(0, EXPLORE_MAX_FEATURES).map((row) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [row.lng, row.lat] },
      properties: {
        placeId: row.place_id,
        name: row.name,
        countryCode: (row.country_code as string | null) ?? null,
        bookCount: row.book_count,
      },
    })),
    truncated,
  };
}

type BookListRow = Database["public"]["Functions"]["books_at_place"]["Returns"][number];

function toBookPage(rows: BookListRow[], page: number): BookListPage {
  const total = Number(rows[0]?.total ?? 0);
  return {
    books: rows.map((row): BookSummary => ({
      id: row.id,
      olWorkId: row.ol_work_id,
      title: row.title,
      authors: row.authors,
      firstPublishYear: row.first_publish_year,
      coverId: row.cover_id,
    })),
    total,
    page,
    pageSize: BOOK_PAGE_SIZE,
    pageCount: Math.max(1, Math.ceil(total / BOOK_PAGE_SIZE)),
  };
}

export async function getBooksAtPlace(placeId: string, page: number): Promise<BookListPage> {
  "use cache";
  cacheLife("hours");
  cacheTag(BOOK_PLACES_TAG);
  const { data, error } = await anonClient().rpc("books_at_place", {
    p_place_id: placeId,
    p_limit: BOOK_PAGE_SIZE,
    p_offset: (page - 1) * BOOK_PAGE_SIZE,
  });
  if (error) throw error;
  return toBookPage(data, page);
}

export async function getBooksInCountry(countryCode: string, page: number): Promise<BookListPage> {
  "use cache";
  cacheLife("hours");
  cacheTag(BOOK_PLACES_TAG);
  const { data, error } = await anonClient().rpc("books_in_country", {
    p_country_code: countryCode,
    p_limit: BOOK_PAGE_SIZE,
    p_offset: (page - 1) * BOOK_PAGE_SIZE,
  });
  if (error) throw error;
  return toBookPage(data, page);
}

export async function getPlace(placeId: string): Promise<PlaceDetail | null> {
  "use cache";
  cacheLife("days");
  cacheTag(BOOK_PLACES_TAG);
  const { data, error } = await anonClient().rpc("place_detail", { p_place_id: placeId });
  if (error) throw error;
  const row = data[0];
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    precision: row.precision,
    countryCode: (row.country_code as string | null) ?? null,
    wikidataId: row.wikidata_id,
    lng: (row.lng as number | null) ?? null,
    lat: (row.lat as number | null) ?? null,
  };
}

export async function getBookDetail(bookId: string): Promise<BookDetail | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(bookTag(bookId), BOOK_PLACES_TAG);
  const supabase = anonClient();
  const { data, error } = await supabase
    .from("books")
    .select(
      "id, ol_work_id, wikidata_id, title, authors, first_publish_year, cover_id, description",
    )
    .eq("id", bookId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    olWorkId: data.ol_work_id,
    wikidataId: data.wikidata_id,
    title: data.title,
    authors: data.authors,
    firstPublishYear: data.first_publish_year,
    coverId: data.cover_id,
    description: data.description,
    places: await listBookPlaces(supabase, [bookId]),
  };
}

export async function searchPlaces(query: string): Promise<PlaceSearchResult[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(BOOK_PLACES_TAG);
  const { data, error } = await anonClient().rpc("search_places", { q: query, max_results: 8 });
  if (error) throw error;
  return data.map((row) => ({
    placeId: row.place_id,
    name: row.name,
    precision: row.precision,
    countryCode: (row.country_code as string | null) ?? null,
    lng: (row.lng as number | null) ?? null,
    lat: (row.lat as number | null) ?? null,
    bookCount: row.book_count,
  }));
}
