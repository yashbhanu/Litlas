/** Builders for personal/public maps: GeoJSON pins, covered countries, stats. Client-safe. */

import { z } from "zod";
import { continentOf, countryName } from "./continents";
import countryBoundsJson from "./country-bounds.json";
import { isPinPrecision, type LocationPrecision } from "./precision";

export type LocationSource = "wikidata" | "user" | "admin";

/** An approved setting of a book, with plain coordinates (null for areas/fictional). */
export interface BookPlace {
  bookId: string;
  placeId: string;
  name: string;
  precision: LocationPrecision;
  countryCode: string | null;
  source: LocationSource;
  lng: number | null;
  lat: number | null;
}

export interface MapBook {
  id: string;
  title: string;
  authors: string[];
}

export interface PinProperties {
  bookId: string;
  placeId: string;
  title: string;
  placeName: string;
}

export interface PinFeature {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: PinProperties;
}

export interface PinCollection {
  type: "FeatureCollection";
  features: PinFeature[];
}

export interface CountryCount {
  code: string;
  name: string;
  count: number;
}

export interface MapStats {
  booksRead: number;
  countries: number;
  continents: number;
  topCountries: CountryCount[];
}

export interface BookPlaces {
  bookId: string;
  title: string;
  places: string[];
}

export interface CountryGroup {
  code: string;
  name: string;
  books: BookPlaces[];
}

export interface UserMap {
  /** point/city settings, one feature per (book, place). */
  pins: PinCollection;
  /** ISO codes of every country a book is set in (shaded on the map). */
  countries: string[];
  stats: MapStats;
  /** List view of the map: books grouped by country. */
  byCountry: CountryGroup[];
  /** Books with fictional settings (not on the map). */
  fictional: BookPlaces[];
  /** Books without any known setting yet. */
  unplaced: { bookId: string; title: string }[];
}

export const TOP_COUNTRIES = 5;

export function buildPins(books: MapBook[], places: BookPlace[]): PinCollection {
  const titles = new Map(books.map((book) => [book.id, book.title]));
  const features: PinFeature[] = [];
  for (const place of places) {
    const title = titles.get(place.bookId);
    if (title === undefined || !isPinPrecision(place.precision)) continue;
    if (place.lng === null || place.lat === null) continue;
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [place.lng, place.lat] },
      properties: { bookId: place.bookId, placeId: place.placeId, title, placeName: place.name },
    });
  }
  return { type: "FeatureCollection", features };
}

/** Distinct real-world countries per book (fictional places don't count). */
function countriesByBook(books: MapBook[], places: BookPlace[]): Map<string, Set<string>> {
  const bookIds = new Set(books.map((book) => book.id));
  const result = new Map<string, Set<string>>();
  for (const place of places) {
    if (!bookIds.has(place.bookId) || place.precision === "fictional" || !place.countryCode) {
      continue;
    }
    const set = result.get(place.bookId) ?? new Set<string>();
    set.add(place.countryCode);
    result.set(place.bookId, set);
  }
  return result;
}

export function computeStats(books: MapBook[], places: BookPlace[]): MapStats {
  const perCountry = new Map<string, number>();
  for (const codes of countriesByBook(books, places).values()) {
    for (const code of codes) perCountry.set(code, (perCountry.get(code) ?? 0) + 1);
  }
  const continents = new Set(
    [...perCountry.keys()].map(continentOf).filter((continent) => continent !== null),
  );
  const topCountries = [...perCountry.entries()]
    .map(([code, count]) => ({ code, name: countryName(code), count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, TOP_COUNTRIES);

  return {
    booksRead: books.length,
    countries: perCountry.size,
    continents: continents.size,
    topCountries,
  };
}

export function buildUserMap(books: MapBook[], places: BookPlace[]): UserMap {
  const byBook = new Map<string, BookPlace[]>();
  for (const place of places) {
    byBook.set(place.bookId, [...(byBook.get(place.bookId) ?? []), place]);
  }

  const groups = new Map<string, CountryGroup>();
  const fictional: BookPlaces[] = [];
  const unplaced: UserMap["unplaced"] = [];

  for (const book of books) {
    const bookPlaces = byBook.get(book.id) ?? [];
    if (bookPlaces.length === 0) {
      unplaced.push({ bookId: book.id, title: book.title });
      continue;
    }
    const fictionalNames = bookPlaces.filter((p) => p.precision === "fictional").map((p) => p.name);
    if (fictionalNames.length)
      fictional.push({ bookId: book.id, title: book.title, places: fictionalNames });

    const namesByCountry = new Map<string, string[]>();
    for (const place of bookPlaces) {
      if (place.precision === "fictional" || !place.countryCode) continue;
      const names = namesByCountry.get(place.countryCode) ?? [];
      if (place.precision !== "country") names.push(place.name);
      namesByCountry.set(place.countryCode, names);
    }
    for (const [code, names] of namesByCountry) {
      const group = groups.get(code) ?? { code, name: countryName(code), books: [] };
      group.books.push({ bookId: book.id, title: book.title, places: names });
      groups.set(code, group);
    }
  }

  const byCountry = [...groups.values()].sort(
    (a, b) => b.books.length - a.books.length || a.name.localeCompare(b.name),
  );

  return {
    pins: buildPins(books, places),
    countries: byCountry.map((group) => group.code).sort(),
    stats: computeStats(books, places),
    byCountry,
    fictional,
    unplaced,
  };
}

export type LngLatBounds = [[number, number], [number, number]];

const COUNTRY_BOUNDS: Partial<Record<string, [number, number, number, number]>> = z
  .record(z.string(), z.tuple([z.number(), z.number(), z.number(), z.number()]))
  .parse(countryBoundsJson);

/**
 * The box to fit when a map opens: every pin plus the mainland of every shaded country
 * (bounds generated by scripts/build-countries.mts). Null when there's nothing to show.
 */
export function mapBounds(pins: PinCollection, countries: string[]): LngLatBounds | null {
  const boxes: [number, number, number, number][] = pins.features.map(({ geometry }) => {
    const [lng, lat] = geometry.coordinates;
    return [lng, lat, lng, lat];
  });
  for (const code of countries) {
    const box = COUNTRY_BOUNDS[code];
    if (box) boxes.push(box);
  }
  if (boxes.length === 0) return null;
  return [
    [Math.min(...boxes.map((b) => b[0])), Math.min(...boxes.map((b) => b[1]))],
    [Math.max(...boxes.map((b) => b[2])), Math.max(...boxes.map((b) => b[3]))],
  ];
}

/** Mainland bounding box of a country, for flying to it. */
export function countryBounds(code: string): LngLatBounds | null {
  const box = COUNTRY_BOUNDS[code];
  return box
    ? [
        [box[0], box[1]],
        [box[2], box[3]],
      ]
    : null;
}

/** ISO codes we have shapes for (for country search). */
export function knownCountryShapes(): string[] {
  return Object.keys(COUNTRY_BOUNDS);
}
