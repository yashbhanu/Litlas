/**
 * Wikidata IDs used by the setting lookup and the seed import. Every class ID below was
 * checked against wikidata.org (label + description) on 2026-11-21 before hard-coding.
 */

export const WIKIDATA_SPARQL_URL = "https://query.wikidata.org/sparql";

/** Properties. */
export const P = {
  instanceOf: "P31",
  subclassOf: "P279",
  author: "P50",
  country: "P17",
  coordinates: "P625",
  narrativeLocation: "P840",
  isoAlpha2: "P297",
  openLibraryId: "P648",
} as const;

/** Classes, matched through `wdt:P31/wdt:P279*`. */
export const Q = {
  /** "country": distinct territorial body or political entity (also England, Scotland…). */
  country: "Q6256",
  /** "city": large human settlement. Kept for reference; settlement below is broader. */
  city: "Q515",
  /** "human settlement": place of any size in which people permanently live. */
  humanSettlement: "Q486972",
  /** "first-level administrative division": states, provinces, regions. */
  firstLevelAdminDivision: "Q10864048",
  /** "continent": large landmass. Too broad to pin (Wikidata gives each one point). */
  continent: "Q5107",
  /** "fictional location": place that exists only in fiction. */
  fictionalLocation: "Q3895768",
  /** "literary work": written work read for enjoyment or edification. */
  literaryWork: "Q7725634",
  /** Excluded from the seed: classes under literary work that are really screen works. */
  film: "Q11424",
  televisionProgram: "Q15416",
  videoGame: "Q7889",
} as const;
