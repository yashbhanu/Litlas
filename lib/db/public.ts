import "server-only";

import { createClient } from "@supabase/supabase-js";
import { cacheLife, cacheTag } from "next/cache";
import {
  BOOK_PAGE_SIZE,
  EXPLORE_MAX_FEATURES,
  type BookDetail,
  type BookListPage,
  type BookSummary,
  type CountryBookPage,
  type ExploreResponse,
  type PlaceDetail,
  type PlaceSearchResult,
} from "@/lib/books/public-types";
import { getPublicEnv } from "@/lib/env";
import type { Bbox } from "@/lib/geo/bbox";
import { countryName } from "@/lib/geo/continents";
import type { Database } from "./database.types";
import { fetchAllPages } from "./paging";
import { findProfileByUsername, loadShelfMap } from "./map";
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
  // Each box returns up to the cap, paged past the API's 1,000-row limit.
  const perBox = await Promise.all(
    boxes.map(([minLng, minLat, maxLng, maxLat]) =>
      fetchAllPages(
        (from, to) =>
          supabase
            .rpc("explore_places", {
              min_lng: minLng,
              min_lat: minLat,
              max_lng: maxLng,
              max_lat: maxLat,
              max_features: EXPLORE_MAX_FEATURES,
            })
            .range(from, to),
        EXPLORE_MAX_FEATURES,
      ),
    ),
  );
  const rows = perBox.flat().sort((a, b) => b.book_count - a.book_count);
  const truncated =
    rows.length > EXPLORE_MAX_FEATURES ||
    perBox.some((boxRows) => boxRows.length >= EXPLORE_MAX_FEATURES);

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

type BookListRow = Database["public"]["Functions"]["books_at_place"]["Returns"][number] & {
  setting?: string | null;
};

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
      setting: row.setting ?? null,
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

export async function getBooksInCountry(
  countryCode: string,
  page: number,
): Promise<CountryBookPage> {
  "use cache";
  cacheLife("hours");
  cacheTag(BOOK_PLACES_TAG);
  const supabase = anonClient();
  const [books, places] = await Promise.all([
    supabase.rpc("books_in_country", {
      p_country_code: countryCode,
      p_limit: BOOK_PAGE_SIZE,
      p_offset: (page - 1) * BOOK_PAGE_SIZE,
    }),
    supabase.rpc("country_places", { p_country_code: countryCode, p_limit: 4 }),
  ]);
  if (books.error) throw books.error;
  if (places.error) throw places.error;
  const name = countryName(countryCode);
  const rows = books.data.map((row) => ({
    ...row,
    // Up to two places, else the country itself.
    setting: row.places.length
      ? row.places.slice(0, 2).join(", ") +
        (row.places.length > 2 ? ` +${row.places.length - 2}` : "")
      : `${name} · country-level`,
  }));
  return {
    ...toBookPage(rows, page),
    country: { code: countryCode, name },
    topPlaces: places.data.map((p) => ({
      placeId: p.place_id,
      name: p.name,
      bookCount: p.book_count,
    })),
    placeCount: Number(places.data[0]?.total ?? 0),
  };
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

/** Books whose title matches (header search), books with covers first. */
export async function searchBooks(query: string): Promise<BookSummary[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(BOOK_PLACES_TAG);
  const pattern = `%${query.replace(/[\\%_]/g, "\\$&")}%`;
  const { data, error } = await anonClient()
    .from("books")
    .select("id, ol_work_id, title, authors, first_publish_year, cover_id")
    .ilike("title", pattern)
    .order("cover_id", { nullsFirst: false })
    .order("title")
    .limit(5);
  if (error) throw error;
  return data.map((row) => ({
    id: row.id,
    olWorkId: row.ol_work_id,
    title: row.title,
    authors: row.authors,
    firstPublishYear: row.first_publish_year,
    coverId: row.cover_id,
  }));
}

export const readerTag = (username: string) => `reader:${username}`;

export interface PublicReadingMap {
  username: string;
  displayName: string | null;
  stats: { booksRead: number; countries: number; continents: number };
  countries: string[];
  /** Distinct pin coordinates [lng, lat]. */
  pins: [number, number][];
}

/**
 * A reader's map as a signed-out visitor sees it (share images). Null if there's no such
 * reader or their profile is private.
 */
export async function loadPublicReadingMap(username: string): Promise<PublicReadingMap | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(readerTag(username), BOOK_PLACES_TAG);
  const supabase = anonClient();
  const profile = await findProfileByUsername(supabase, username);
  if (!profile || !profile.isPublic) return null;
  const { map } = await loadShelfMap(supabase, profile.id);
  const pins = new Map<string, [number, number]>();
  for (const feature of map.pins.features) {
    const [lng, lat] = feature.geometry.coordinates;
    pins.set(`${lng.toFixed(2)},${lat.toFixed(2)}`, [lng, lat]);
  }
  return {
    username: profile.username,
    displayName: profile.displayName,
    stats: {
      booksRead: map.stats.booksRead,
      countries: map.stats.countries,
      continents: map.stats.continents,
    },
    countries: map.countries,
    pins: [...pins.values()],
  };
}

/** Ids for the sitemap: every book, places with approved books, countries with books. */
export async function listSitemapIds(): Promise<{
  books: { id: string; createdAt: string | null }[];
  places: string[];
  countries: string[];
}> {
  "use cache";
  cacheLife("days");
  cacheTag(BOOK_PLACES_TAG);
  const supabase = anonClient();
  const [books, places] = await Promise.all([
    fetchAllPages((from, to) =>
      supabase.from("books").select("id, created_at").order("id").range(from, to),
    ),
    fetchAllPages((from, to) =>
      supabase
        .from("places")
        .select("id, country_code, book_places!inner(status)")
        .eq("book_places.status", "approved")
        .neq("precision", "fictional")
        .order("id")
        .range(from, to),
    ),
  ]);
  return {
    books: books.map((b) => ({ id: b.id, createdAt: b.created_at })),
    places: [...new Set(places.map((p) => p.id))],
    countries: [...new Set(places.flatMap((p) => (p.country_code ? [p.country_code] : [])))].sort(),
  };
}

export interface LandingData {
  totals: { books: number; places: number; countries: number };
  /** Most-read places, at most one per country. */
  featured: { placeId: string; name: string; countryCode: string | null; bookCount: number }[];
  /** Pins for the sample map: the most-read places worldwide. */
  pins: [number, number][];
  /** Countries with the most-read places, shaded on the sample map. */
  countries: string[];
}

/** Numbers, featured places and a sample map for the landing page. */
export async function getLandingData(): Promise<LandingData> {
  "use cache";
  cacheLife("days");
  cacheTag(BOOK_PLACES_TAG);
  const [ids, world] = await Promise.all([listSitemapIds(), explorePlaces([[-180, -85, 180, 85]])]);
  const featured: LandingData["featured"] = [];
  const seen = new Set<string>();
  for (const { properties } of world.features) {
    const country = properties.countryCode ?? properties.placeId;
    if (seen.has(country)) continue;
    seen.add(country);
    featured.push(properties);
    if (featured.length === 6) break;
  }
  return {
    totals: { books: ids.books.length, places: ids.places.length, countries: ids.countries.length },
    featured,
    pins: world.features.slice(0, 350).map((f) => f.geometry.coordinates),
    countries: featured.flatMap((f) => (f.countryCode ? [f.countryCode] : [])),
  };
}
