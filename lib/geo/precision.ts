/** Location precision rules (see SPEC → Map display rules). Client-safe. */

export const LOCATION_PRECISIONS = ["point", "city", "region", "country", "fictional"] as const;
export type LocationPrecision = (typeof LOCATION_PRECISIONS)[number];

/** point/city render as a pin. */
export function isPinPrecision(precision: LocationPrecision): boolean {
  return precision === "point" || precision === "city";
}

/**
 * region/country render as a shaded area. We only ship country shapes, so a region
 * shades its whole country.
 */
export function isAreaPrecision(precision: LocationPrecision): boolean {
  return precision === "region" || precision === "country";
}

/** What we know about a Wikidata place, as returned by the narrative-location query. */
export interface PlaceFacts {
  isFictional: boolean;
  isCountry: boolean;
  isSettlement: boolean;
  isFirstLevelRegion: boolean;
  hasCoordinates: boolean;
  countryCode: string | null;
}

/**
 * Classify a place. Returns null when it can't be placed at all (no coordinates and no
 * country, e.g. a newspaper listed as a "narrative location").
 */
export function classifyPlace(facts: PlaceFacts): LocationPrecision | null {
  if (facts.isFictional) return "fictional";
  if (facts.isCountry) return facts.countryCode ? "country" : null;
  if (facts.isFirstLevelRegion) return facts.countryCode ? "region" : null;
  if (facts.hasCoordinates) return facts.isSettlement ? "city" : "point";
  // Somewhere in a known country, but no coordinates: shade the country.
  if (facts.countryCode) return "region";
  return null;
}
