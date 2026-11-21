import type { LocationPrecision } from "@/lib/geo/precision";

/** A geocoding result from Photon, normalized (GET /api/places/search). */
export interface PlaceCandidate {
  /** OSM id with type prefix: N (node), W (way) or R (relation), e.g. "R7426387". */
  osmId: string;
  name: string;
  /** Short context for the picker, e.g. "Bogota, Capital District, Colombia". */
  description: string;
  countryCode: string | null;
  lng: number;
  lat: number;
  /** Precision the picker preselects for this result. */
  suggestedPrecision: Exclude<LocationPrecision, "fictional" | "point">;
}

/** A pending suggestion on a book (GET /api/books/[id]). */
export interface PendingSuggestion {
  bookPlaceId: string;
  placeId: string;
  name: string;
  precision: LocationPrecision;
  countryCode: string | null;
  createdAt: string;
  votes: number;
  /** The viewer made this suggestion (and can't vote on it). */
  mine: boolean;
  /** The viewer has confirmed it. */
  voted: boolean;
}

export interface SuggestLocationResponse {
  suggestion: PendingSuggestion | null;
  /** "pending", or "approved" when it reached the threshold (or was already listed). */
  status: "pending" | "approved";
}

export interface VoteResponse {
  status: "pending" | "approved";
  votes: number;
}
