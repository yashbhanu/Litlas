/**
 * Seed import: SPARQL queries and normalization (pure, unit tested). The runner lives in
 * scripts/seed-wikidata.ts.
 *
 * The spec's single query (all literary works with P840 + labels, LIMIT/OFFSET) times out
 * on the Wikidata Query Service: the label service is the slow part, and the full result
 * doesn't fit in the 60 s limit. So the import is split:
 *   1. classes   — subclasses of literary work that have narrative locations
 *   2. book ids  — per class, paged with LIMIT/OFFSET (ids only, cheap)
 *   3. details   — per batch of book ids (VALUES): labels via rdfs:label, OL id, places
 *   4. flags     — per batch of place ids: country / fictional / settlement / region
 */

import {
  parseNarrativeLocations,
  qidFromUri,
  type Binding,
  type WikidataPlace,
} from "@/lib/external/wikidata";
import { P, Q } from "@/lib/external/wikidata-constants";

const qidPattern = /^Q\d+$/;

function values(qids: string[]): string {
  for (const qid of qids) {
    if (!qidPattern.test(qid)) throw new Error(`Invalid Wikidata id: ${qid}`);
  }
  return qids.map((qid) => `wd:${qid}`).join(" ");
}

/** English label, falling back to the language-neutral "mul" label. */
function label(subject: string, variable: string): string {
  return `OPTIONAL { ${subject} rdfs:label ?${variable}En . FILTER(LANG(?${variable}En) = "en") }
  OPTIONAL { ${subject} rdfs:label ?${variable}Mul . FILTER(LANG(?${variable}Mul) = "mul") }
  BIND(COALESCE(?${variable}En, ?${variable}Mul) AS ?${variable})`;
}

/** Classes under "literary work" used with P840, minus film/TV/game classes. */
export function seedClassesQuery(): string {
  return `SELECT ?cls ?n WHERE {
  { SELECT ?cls (COUNT(DISTINCT ?book) AS ?n) WHERE {
      ?book wdt:${P.narrativeLocation} [] ; wdt:${P.instanceOf} ?cls .
    } GROUP BY ?cls }
  ?cls wdt:${P.subclassOf}* wd:${Q.literaryWork} .
  FILTER NOT EXISTS { ?cls wdt:${P.subclassOf}* wd:${Q.film} }
  FILTER NOT EXISTS { ?cls wdt:${P.subclassOf}* wd:${Q.televisionProgram} }
  FILTER NOT EXISTS { ?cls wdt:${P.subclassOf}* wd:${Q.videoGame} }
} ORDER BY DESC(?n)`;
}

/** One page of book ids for a class. Books with several settings repeat; dedupe after. */
export function seedBookIdsQuery(classQid: string, limit: number, offset: number): string {
  return `SELECT ?book WHERE {
  ?book wdt:${P.instanceOf} ${values([classQid])} ; wdt:${P.narrativeLocation} [] .
} LIMIT ${Math.trunc(limit)} OFFSET ${Math.trunc(offset)}`;
}

export function seedBookDetailsQuery(bookQids: string[]): string {
  return `SELECT ?book ?bookLabel ?olid ?author ?authorLabel ?place ?placeLabel ?coord ?countryCode ?ownCode WHERE {
  VALUES ?book { ${values(bookQids)} }
  ?book wdt:${P.narrativeLocation} ?place .
  ${label("?book", "bookLabel")}
  ${label("?place", "placeLabel")}
  OPTIONAL { ?book wdt:${P.openLibraryId} ?olid . }
  OPTIONAL { ?book wdt:${P.author} ?author . ${label("?author", "authorLabel")} }
  OPTIONAL { ?place wdt:${P.coordinates} ?coord . }
  OPTIONAL { ?place wdt:${P.country} ?c . ?c wdt:${P.isoAlpha2} ?countryCode . }
  OPTIONAL { ?place wdt:${P.isoAlpha2} ?ownCode . }
}`;
}

export function seedPlaceFlagsQuery(placeQids: string[]): string {
  return `SELECT ?place ?isCountry ?isFictional ?isSettlement ?isRegion ?isContinent WHERE {
  VALUES ?place { ${values(placeQids)} }
  BIND(EXISTS { ?place wdt:${P.instanceOf}/wdt:${P.subclassOf}* wd:${Q.country} } AS ?isCountry)
  BIND(EXISTS { ?place wdt:${P.instanceOf}/wdt:${P.subclassOf}* wd:${Q.fictionalLocation} } AS ?isFictional)
  BIND(EXISTS { ?place wdt:${P.instanceOf}/wdt:${P.subclassOf}* wd:${Q.humanSettlement} } AS ?isSettlement)
  BIND(EXISTS { ?place wdt:${P.instanceOf}/wdt:${P.subclassOf}* wd:${Q.firstLevelAdminDivision} } AS ?isRegion)
  BIND(EXISTS { ?place wdt:${P.instanceOf}/wdt:${P.subclassOf}* wd:${Q.continent} } AS ?isContinent)
}`;
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

export function parseQids(bindings: Binding[], variable: string): string[] {
  const ids = new Set<string>();
  for (const binding of bindings) {
    const value = binding[variable]?.value;
    const qid = value ? qidFromUri(value) : null;
    if (qid) ids.add(qid);
  }
  return [...ids];
}

export function parseClasses(bindings: Binding[]): { qid: string; count: number }[] {
  return bindings.flatMap((binding) => {
    const qid = binding.cls ? qidFromUri(binding.cls.value) : null;
    const count = Number(binding.n?.value);
    return qid && Number.isFinite(count) ? [{ qid, count }] : [];
  });
}

export type PlaceFlags = Record<
  "isCountry" | "isFictional" | "isSettlement" | "isRegion" | "isContinent",
  boolean
>;

export function parsePlaceFlags(bindings: Binding[]): Map<string, PlaceFlags> {
  const flags = new Map<string, PlaceFlags>();
  for (const binding of bindings) {
    const qid = binding.place ? qidFromUri(binding.place.value) : null;
    if (!qid) continue;
    flags.set(qid, {
      isCountry: binding.isCountry?.value === "true",
      isFictional: binding.isFictional?.value === "true",
      isSettlement: binding.isSettlement?.value === "true",
      isRegion: binding.isRegion?.value === "true",
      isContinent: binding.isContinent?.value === "true",
    });
  }
  return flags;
}

export interface SeedBook {
  wikidataId: string;
  title: string;
  authors: string[];
  /** Open Library work id (P648 also holds edition/author ids, which are dropped). */
  olWorkId: string | null;
  /** Wikidata ids of the book's placeable settings. */
  placeIds: string[];
}

export type SkipReason =
  | "book without an English title"
  | "book without a placeable setting"
  | "place without a label, coordinates or country, or a continent";

export interface SeedData {
  books: SeedBook[];
  places: WikidataPlace[];
  links: number;
  skipped: Partial<Record<SkipReason, number>>;
}

const olWorkIdPattern = /^OL\d+W$/;

/**
 * Group detail rows by book, classify places with their flags (same rules as the
 * per-book lookup), and drop what can't be imported, counting why.
 */
export function normalizeSeed(detailRows: Binding[], flags: Map<string, PlaceFlags>): SeedData {
  const skipped: SeedData["skipped"] = {};
  const skip = (reason: SkipReason, n = 1) => {
    skipped[reason] = (skipped[reason] ?? 0) + n;
  };

  // Places: reuse the narrative-location parser by merging each row with its flags.
  const placeRows: Binding[] = detailRows.map((row) => {
    const qid = row.place ? qidFromUri(row.place.value) : null;
    const placeFlags = qid ? flags.get(qid) : undefined;
    const flagBindings: Binding = {};
    for (const [key, value] of Object.entries(placeFlags ?? {})) {
      flagBindings[key] = { type: "literal", value: String(value) };
    }
    return { ...row, ...flagBindings };
  });
  const places = parseNarrativeLocations(placeRows);
  const placeIds = new Set(places.map((place) => place.wikidataId));
  skip(
    "place without a label, coordinates or country, or a continent",
    parseQids(detailRows, "place").length - places.length,
  );

  // Books.
  const grouped = new Map<
    string,
    { title: string | null; authors: Set<string>; olids: Set<string>; places: Set<string> }
  >();
  for (const row of detailRows) {
    const bookQid = row.book ? qidFromUri(row.book.value) : null;
    if (!bookQid) continue;
    const entry = grouped.get(bookQid) ?? {
      title: null,
      authors: new Set<string>(),
      olids: new Set<string>(),
      places: new Set<string>(),
    };
    const title = row.bookLabel?.value.trim();
    if (title && !entry.title) entry.title = title;
    const author = row.authorLabel?.value.trim();
    if (author && !qidPattern.test(author)) entry.authors.add(author);
    const olid = row.olid?.value.trim();
    if (olid && olWorkIdPattern.test(olid)) entry.olids.add(olid);
    const placeQid = row.place ? qidFromUri(row.place.value) : null;
    if (placeQid && placeIds.has(placeQid)) entry.places.add(placeQid);
    grouped.set(bookQid, entry);
  }

  const books: SeedBook[] = [];
  let links = 0;
  for (const [wikidataId, entry] of grouped) {
    if (!entry.title) {
      skip("book without an English title");
      continue;
    }
    if (entry.places.size === 0) {
      skip("book without a placeable setting");
      continue;
    }
    books.push({
      wikidataId,
      title: entry.title,
      authors: [...entry.authors].sort(),
      // Several OL work ids on one item: take the lowest for a stable choice.
      olWorkId:
        [...entry.olids].sort((a, b) => a.length - b.length || a.localeCompare(b))[0] ?? null,
      placeIds: [...entry.places].sort(),
    });
    links += entry.places.size;
  }
  books.sort((a, b) => a.wikidataId.localeCompare(b.wikidataId));

  // Only keep places some imported book uses.
  const used = new Set(books.flatMap((book) => book.placeIds));
  return { books, places: places.filter((place) => used.has(place.wikidataId)), links, skipped };
}

/** Split into chunks of `size`. */
export function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}
