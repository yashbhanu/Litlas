import "server-only";

import { z } from "zod";
import { classifyPlace, type LocationPrecision } from "@/lib/geo/precision";
import { fetchJson, type FetchFn } from "./http";
import { P, Q, WIKIDATA_SPARQL_URL } from "./wikidata-constants";

const SERVICE = "wikidata";

// ---------------------------------------------------------------------------
// SPARQL response schema
// ---------------------------------------------------------------------------

const bindingValueSchema = z.object({ type: z.string(), value: z.string() });
const sparqlResponseSchema = z.object({
  results: z.object({ bindings: z.array(z.record(z.string(), bindingValueSchema)) }),
});
type Binding = z.infer<typeof sparqlResponseSchema>["results"]["bindings"][number];

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** Escape a value for a SPARQL string literal. */
export function sparqlString(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "")}"`;
}

const qidPattern = /^Q\d+$/;
const olWorkIdPattern = /^OL\d+W$/;

export function bookByOpenLibraryIdQuery(olWorkId: string): string {
  if (!olWorkIdPattern.test(olWorkId)) throw new Error(`Invalid Open Library id: ${olWorkId}`);
  return `SELECT ?book WHERE { ?book wdt:${P.openLibraryId} ${sparqlString(olWorkId)} . } LIMIT 2`;
}

/** Fallback: exact English title + author labels, restricted to literary works. */
export function bookByTitleAuthorQuery(title: string, author: string): string {
  return `SELECT DISTINCT ?book WHERE {
  ?book rdfs:label ${sparqlString(title)}@en ;
        wdt:${P.author} ?author ;
        wdt:${P.instanceOf}/wdt:${P.subclassOf}* wd:${Q.literaryWork} .
  ?author rdfs:label ${sparqlString(author)}@en .
} LIMIT 2`;
}

export function narrativeLocationsQuery(bookQid: string): string {
  if (!qidPattern.test(bookQid)) throw new Error(`Invalid Wikidata id: ${bookQid}`);
  return `SELECT ?place ?placeLabel ?coord ?countryCode ?ownCode ?isCountry ?isFictional ?isSettlement ?isRegion WHERE {
  wd:${bookQid} wdt:${P.narrativeLocation} ?place .
  OPTIONAL { ?place wdt:${P.coordinates} ?coord . }
  OPTIONAL { ?place wdt:${P.country} ?country . ?country wdt:${P.isoAlpha2} ?countryCode . }
  OPTIONAL { ?place wdt:${P.isoAlpha2} ?ownCode . }
  BIND(EXISTS { ?place wdt:${P.instanceOf}/wdt:${P.subclassOf}* wd:${Q.country} } AS ?isCountry)
  BIND(EXISTS { ?place wdt:${P.instanceOf}/wdt:${P.subclassOf}* wd:${Q.fictionalLocation} } AS ?isFictional)
  BIND(EXISTS { ?place wdt:${P.instanceOf}/wdt:${P.subclassOf}* wd:${Q.humanSettlement} } AS ?isSettlement)
  BIND(EXISTS { ?place wdt:${P.instanceOf}/wdt:${P.subclassOf}* wd:${Q.firstLevelAdminDivision} } AS ?isRegion)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}`;
}

// ---------------------------------------------------------------------------
// Parsing (pure, unit tested)
// ---------------------------------------------------------------------------

export interface WikidataPlace {
  wikidataId: string;
  name: string;
  precision: LocationPrecision;
  countryCode: string | null;
  /** [lng, lat] for places with coordinates, else null. */
  coordinates: [number, number] | null;
}

/** "http://www.wikidata.org/entity/Q1761" → "Q1761" (null if not an item URI). */
export function qidFromUri(uri: string): string | null {
  const id = uri.split("/").pop() ?? "";
  return qidPattern.test(id) ? id : null;
}

/**
 * Parse a WKT literal "Point(lng lat)". Coordinates on other globes are prefixed with
 * the globe's URI ("<…/Q405> Point(…)") and are rejected.
 */
export function parseWktPoint(wkt: string): [number, number] | null {
  const match = /^Point\((-?\d+(?:\.\d+)?(?:[eE]-?\d+)?) (-?\d+(?:\.\d+)?(?:[eE]-?\d+)?)\)$/.exec(
    wkt.trim(),
  );
  if (!match) return null;
  const lng = Number(match[1]);
  const lat = Number(match[2]);
  if (Math.abs(lng) > 180 || Math.abs(lat) > 90) return null;
  return [lng, lat];
}

function normalizeCountryCode(code: string | undefined): string | null {
  const upper = code?.trim().toUpperCase();
  return upper && /^[A-Z]{2}$/.test(upper) ? upper : null;
}

const isTrue = (binding: Binding, key: string) => binding[key]?.value === "true";

/**
 * Turn narrative-location rows into places. The query returns one row per combination
 * of coordinates and countries, so rows are grouped by place: the first coordinates
 * win, and a place's own ISO code beats its P17 country's code. Unplaceable items and
 * items without an English label are dropped.
 */
export function parseNarrativeLocations(bindings: Binding[]): WikidataPlace[] {
  const grouped = new Map<
    string,
    {
      name: string;
      coordinates: [number, number] | null;
      ownCode: string | null;
      countryCodes: string[];
      flags: { isCountry: boolean; isFictional: boolean; isSettlement: boolean; isRegion: boolean };
    }
  >();

  for (const binding of bindings) {
    const placeUri = binding.place?.value;
    const wikidataId = placeUri ? qidFromUri(placeUri) : null;
    if (!wikidataId) continue;

    const entry = grouped.get(wikidataId) ?? {
      name: binding.placeLabel?.value.trim() ?? "",
      coordinates: null,
      ownCode: null,
      countryCodes: [],
      flags: {
        isCountry: isTrue(binding, "isCountry"),
        isFictional: isTrue(binding, "isFictional"),
        isSettlement: isTrue(binding, "isSettlement"),
        isRegion: isTrue(binding, "isRegion"),
      },
    };
    entry.coordinates ??= binding.coord ? parseWktPoint(binding.coord.value) : null;
    entry.ownCode ??= normalizeCountryCode(binding.ownCode?.value);
    const countryCode = normalizeCountryCode(binding.countryCode?.value);
    if (countryCode && !entry.countryCodes.includes(countryCode)) {
      entry.countryCodes.push(countryCode);
    }
    grouped.set(wikidataId, entry);
  }

  const places: WikidataPlace[] = [];
  for (const [wikidataId, entry] of grouped) {
    // Items without an English label come back labelled with their own QID.
    if (!entry.name || qidPattern.test(entry.name)) continue;
    const countryCode = entry.ownCode ?? entry.countryCodes[0] ?? null;
    const precision = classifyPlace({
      isFictional: entry.flags.isFictional,
      // Having its own ISO 3166-1 code means it is a country, whatever its P31 says.
      isCountry: entry.flags.isCountry || entry.ownCode !== null,
      isSettlement: entry.flags.isSettlement,
      isFirstLevelRegion: entry.flags.isRegion,
      hasCoordinates: entry.coordinates !== null,
      countryCode,
    });
    if (!precision) continue;
    places.push({
      wikidataId,
      name: entry.name,
      precision,
      countryCode,
      // Countries and fictional places are never drawn as points.
      coordinates: precision === "country" || precision === "fictional" ? null : entry.coordinates,
    });
  }
  return places.sort((a, b) => a.name.localeCompare(b.name));
}

/** The single book QID in a result, or null when there are none or it's ambiguous. */
export function parseSingleBook(bindings: Binding[]): string | null {
  const ids = new Set(
    bindings.map((binding) => (binding.book ? qidFromUri(binding.book.value) : null)),
  );
  ids.delete(null);
  return ids.size === 1 ? [...ids][0]! : null;
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export interface WikidataClientOptions {
  userAgent: string;
  fetch?: FetchFn;
  sleep?: (ms: number) => Promise<void>;
}

export function createWikidataClient(options: WikidataClientOptions) {
  const http = {
    service: SERVICE,
    accept: "application/sparql-results+json",
    retries: 3,
    baseDelayMs: 1000,
    timeoutMs: 15_000,
    ...options,
  };

  // Wikidata asks clients not to send parallel bursts: every query waits for the last.
  let queue: Promise<unknown> = Promise.resolve();
  function serialized<T>(task: () => Promise<T>): Promise<T> {
    const run = queue.then(task, task);
    queue = run.catch(() => undefined);
    return run;
  }

  async function select(query: string): Promise<Binding[]> {
    const url = new URL(WIKIDATA_SPARQL_URL);
    url.searchParams.set("query", query);
    const body = await serialized(() => fetchJson(url.toString(), sparqlResponseSchema, http));
    return body?.results.bindings ?? [];
  }

  /**
   * Resolve a book's QID from its Open Library work id (P648), falling back to an exact
   * title + first-author match. Only an unambiguous single result is accepted.
   */
  async function findBookId(book: {
    olWorkId: string | null;
    title: string;
    authors: string[];
  }): Promise<string | null> {
    if (book.olWorkId) {
      const byOlId = parseSingleBook(await select(bookByOpenLibraryIdQuery(book.olWorkId)));
      if (byOlId) return byOlId;
    }
    const author = book.authors[0];
    if (!author) return null;
    return parseSingleBook(await select(bookByTitleAuthorQuery(book.title, author)));
  }

  async function getNarrativeLocations(bookQid: string): Promise<WikidataPlace[]> {
    return parseNarrativeLocations(await select(narrativeLocationsQuery(bookQid)));
  }

  return { findBookId, getNarrativeLocations };
}

export type WikidataClient = ReturnType<typeof createWikidataClient>;
