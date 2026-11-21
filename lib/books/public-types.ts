import type { BookPlace } from "@/lib/geo/map";
import type { LocationPrecision } from "@/lib/geo/precision";

/** A book in a public listing (explore panel, place and country pages). */
export interface BookSummary {
  id: string;
  olWorkId: string | null;
  title: string;
  authors: string[];
  firstPublishYear: number | null;
  coverId: number | null;
  /** Where the book is set, in the context of the list (e.g. "Bogotá"). */
  setting?: string | null;
}

export interface BookListPage {
  books: BookSummary[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export interface BookDetail extends BookSummary {
  description: string | null;
  wikidataId: string | null;
  places: BookPlace[];
}

export interface PlaceDetail {
  id: string;
  name: string;
  precision: LocationPrecision;
  countryCode: string | null;
  wikidataId: string | null;
  lng: number | null;
  lat: number | null;
}

export interface ExplorePinProperties {
  placeId: string;
  name: string;
  countryCode: string | null;
  bookCount: number;
}

export interface ExploreResponse {
  type: "FeatureCollection";
  features: {
    type: "Feature";
    geometry: { type: "Point"; coordinates: [number, number] };
    properties: ExplorePinProperties;
  }[];
  /** True when the box held more places than the cap; zooming in shows the rest. */
  truncated: boolean;
}

export interface PlaceSearchResult {
  placeId: string;
  name: string;
  precision: LocationPrecision;
  countryCode: string | null;
  lng: number | null;
  lat: number | null;
  bookCount: number;
}

export interface CountryPlace {
  placeId: string;
  name: string;
  bookCount: number;
}

/** Books in a country, plus its top places and how many places it has. */
export interface CountryBookPage extends BookListPage {
  country: { code: string; name: string };
  topPlaces: CountryPlace[];
  placeCount: number;
}

export const BOOK_PAGE_SIZE = 20;
export const EXPLORE_MAX_FEATURES = 2000;
