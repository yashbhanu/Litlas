/**
 * Seed import: fills books, places and book_places from Wikidata so Explore is never
 * empty. Safe to rerun (idempotent on Wikidata ids). Raw responses are cached in
 * data/seed/ so reruns don't re-query; pass --refresh to query again.
 *
 *   pnpm seed --dry-run --limit 200    # fetch + normalize, log counts, no DB writes
 *   pnpm seed                          # full import into the database in .env.local
 *   pnpm seed --covers --limit 100     # also backfill Open Library covers (1 req/s)
 *   pnpm seed --env .env.production --yes   # a non-local database needs --yes
 *
 * Flags: --dry-run, --limit <books>, --refresh, --covers, --env <file>, --yes
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import { ExternalApiError, fetchJson } from "@/lib/external/http";
import { createOpenLibraryClient } from "@/lib/external/openlibrary";
import { sparqlResponseSchema, type Binding } from "@/lib/external/wikidata";
import { WIKIDATA_SPARQL_URL } from "@/lib/external/wikidata-constants";
import {
  chunk,
  normalizeSeed,
  parseClasses,
  parsePlaceFlags,
  parseQids,
  seedBookDetailsQuery,
  seedBookIdsQuery,
  seedClassesQuery,
  seedPlaceFlagsQuery,
  type SeedBook,
} from "@/lib/seed/wikidata-seed";

const ID_PAGE_SIZE = 5000;
const MIN_ID_PAGE_SIZE = 625;
const DETAIL_BATCH = 300;
const MIN_DETAIL_BATCH = 20;
const FLAG_BATCH = 300;
const DB_BATCH = 500;
const PAUSE_MS = 1000; // between Wikidata queries
const COVER_INTERVAL_MS = 1000; // Open Library: 1 request per second

const CACHE_DIR = join(import.meta.dirname, "..", "data", "seed");

// ---------------------------------------------------------------------------
// Args and env
// ---------------------------------------------------------------------------

const { values: args } = parseArgs({
  options: {
    "dry-run": { type: "boolean", default: false },
    limit: { type: "string" },
    refresh: { type: "boolean", default: false },
    covers: { type: "boolean", default: false },
    env: { type: "string", default: ".env.local" },
    yes: { type: "boolean", default: false },
  },
});
const dryRun = args["dry-run"];
const limit = args.limit === undefined ? Infinity : Number(args.limit);
if (!(limit > 0)) throw new Error("--limit must be a positive number");

if (existsSync(args.env)) process.loadEnvFile(args.env);
const userAgent =
  process.env.APP_USER_AGENT ?? "LiteraryWorldMap/0.1 (seed script; set APP_USER_AGENT)";

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const log = (...parts: unknown[]) => console.log(...parts);

// ---------------------------------------------------------------------------
// Wikidata with a file cache
// ---------------------------------------------------------------------------

let lastQueryAt = 0;

async function sparql(query: string, cacheName: string): Promise<Binding[]> {
  const file = join(CACHE_DIR, `${cacheName}.json`);
  if (!args.refresh && existsSync(file)) {
    return (JSON.parse(readFileSync(file, "utf8")) as { bindings: Binding[] }).bindings;
  }
  // Serialized and paced: one query at a time, at most one per PAUSE_MS.
  const wait = lastQueryAt + PAUSE_MS - Date.now();
  if (wait > 0) await sleep(wait);
  const url = new URL(WIKIDATA_SPARQL_URL);
  url.searchParams.set("query", query);
  try {
    const body = await fetchJson(url.toString(), sparqlResponseSchema, {
      service: "wikidata",
      userAgent,
      accept: "application/sparql-results+json",
      retries: 3,
      baseDelayMs: 2000,
      timeoutMs: 75_000,
    });
    const bindings = body?.results.bindings ?? [];
    mkdirSync(join(file, ".."), { recursive: true });
    writeFileSync(file, JSON.stringify({ query, bindings }));
    return bindings;
  } finally {
    lastQueryAt = Date.now();
  }
}

const hash = (ids: string[]) => createHash("sha1").update(ids.join(",")).digest("hex").slice(0, 16);

async function listClasses() {
  const classes = parseClasses(await sparql(seedClassesQuery(), "classes"));
  log(`Classes under "literary work" with settings: ${classes.length}`);
  return classes;
}

/** Book ids for one class, paging with LIMIT/OFFSET; halves the page size on timeouts. */
async function listBookIds(classQid: string, want: number, into: Set<string>) {
  let offset = 0;
  let pageSize = ID_PAGE_SIZE;
  while (into.size < want) {
    let rows: Binding[];
    try {
      rows = await sparql(
        seedBookIdsQuery(classQid, pageSize, offset),
        `ids/${classQid}-${offset}-${pageSize}`,
      );
    } catch (error) {
      if (error instanceof ExternalApiError && pageSize > MIN_ID_PAGE_SIZE) {
        pageSize /= 2;
        log(`  ids ${classQid} @${offset}: ${error.message}; retrying with pages of ${pageSize}`);
        continue;
      }
      throw error;
    }
    for (const qid of parseQids(rows, "book")) {
      if (into.size >= want) break;
      into.add(qid);
    }
    if (rows.length < pageSize) break;
    offset += pageSize;
  }
}

/** Detail rows for a batch of books; splits the batch in half if it times out. */
async function fetchDetails(bookQids: string[]): Promise<Binding[]> {
  try {
    return await sparql(seedBookDetailsQuery(bookQids), `details/${hash(bookQids)}`);
  } catch (error) {
    if (error instanceof ExternalApiError && bookQids.length > MIN_DETAIL_BATCH) {
      const half = Math.ceil(bookQids.length / 2);
      log(`  details batch of ${bookQids.length} failed (${error.message}); splitting`);
      return [
        ...(await fetchDetails(bookQids.slice(0, half))),
        ...(await fetchDetails(bookQids.slice(half))),
      ];
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Database writes (service role)
// ---------------------------------------------------------------------------

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      `NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (${args.env})`,
    );
  }
  const host = new URL(url).hostname;
  const isLocal = host === "127.0.0.1" || host === "localhost";
  if (!isLocal && !args.yes) {
    throw new Error(`Refusing to write to ${host} without --yes`);
  }
  log(`Database: ${host}${isLocal ? " (local)" : ""}`);
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

type Admin = ReturnType<typeof adminClient>;

async function upsertPlaces(admin: Admin, places: ReturnType<typeof normalizeSeed>["places"]) {
  const ids = new Map<string, string>();
  for (const batch of chunk(places, DB_BATCH)) {
    const { data, error } = await admin
      .from("places")
      .upsert(
        batch.map((place) => ({
          wikidata_id: place.wikidataId,
          name: place.name,
          precision: place.precision,
          country_code: place.countryCode,
          geom: place.coordinates
            ? `SRID=4326;POINT(${place.coordinates[0]} ${place.coordinates[1]})`
            : null,
        })),
        { onConflict: "wikidata_id" },
      )
      .select("id, wikidata_id");
    if (error) throw error;
    for (const row of data) if (row.wikidata_id) ids.set(row.wikidata_id, row.id);
  }
  return ids;
}

/**
 * Books are matched on wikidata_id first, then on ol_work_id (a reader may already have
 * added the book from Open Library). Existing rows keep their Open Library metadata;
 * only a missing wikidata_id is filled in. Returns wikidata id → book id, and counts.
 */
async function upsertBooks(admin: Admin, books: SeedBook[]) {
  const ids = new Map<string, string>();
  let inserted = 0;
  let matched = 0;
  const claimedOlids = new Set<string>();
  const now = new Date().toISOString();

  for (const batch of chunk(books, DB_BATCH)) {
    const qids = batch.map((book) => book.wikidataId);
    const olids = batch.flatMap((book) => (book.olWorkId ? [book.olWorkId] : []));

    const { data: byQid, error: qidError } = await admin
      .from("books")
      .select("id, wikidata_id")
      .in("wikidata_id", qids);
    if (qidError) throw qidError;
    for (const row of byQid) if (row.wikidata_id) ids.set(row.wikidata_id, row.id);

    const { data: byOlid, error: olidError } = olids.length
      ? await admin.from("books").select("id, ol_work_id, wikidata_id").in("ol_work_id", olids)
      : { data: [], error: null };
    if (olidError) throw olidError;
    const existingByOlid = new Map(byOlid.map((row) => [row.ol_work_id, row]));

    const toInsert = [];
    for (const book of batch) {
      if (ids.has(book.wikidataId)) {
        matched++;
        continue;
      }
      const existing = book.olWorkId ? existingByOlid.get(book.olWorkId) : undefined;
      if (existing) {
        matched++;
        ids.set(book.wikidataId, existing.id);
        if (!existing.wikidata_id) {
          const { error } = await admin
            .from("books")
            .update({ wikidata_id: book.wikidataId })
            .eq("id", existing.id);
          if (error) throw error;
        }
        continue;
      }
      // Two Wikidata items can carry the same OL id; only the first gets it.
      const olWorkId = book.olWorkId && !claimedOlids.has(book.olWorkId) ? book.olWorkId : null;
      if (olWorkId) claimedOlids.add(olWorkId);
      toInsert.push({
        wikidata_id: book.wikidataId,
        title: book.title,
        authors: book.authors,
        ol_work_id: olWorkId,
        setting_checked_at: now,
      });
    }

    if (toInsert.length) {
      const { data, error } = await admin
        .from("books")
        .upsert(toInsert, { onConflict: "wikidata_id", ignoreDuplicates: true })
        .select("id, wikidata_id");
      if (error) throw error;
      inserted += data.length;
      for (const row of data) if (row.wikidata_id) ids.set(row.wikidata_id, row.id);
    }
  }
  return { ids, inserted, matched };
}

async function insertLinks(
  admin: Admin,
  books: SeedBook[],
  bookIds: Map<string, string>,
  placeIds: Map<string, string>,
) {
  const rows = books.flatMap((book) => {
    const bookId = bookIds.get(book.wikidataId);
    if (!bookId) return [];
    return book.placeIds.flatMap((placeQid) => {
      const placeId = placeIds.get(placeQid);
      return placeId
        ? [
            {
              book_id: bookId,
              place_id: placeId,
              source: "wikidata" as const,
              status: "approved" as const,
            },
          ]
        : [];
    });
  });
  let inserted = 0;
  for (const batch of chunk(rows, DB_BATCH)) {
    // Existing links (including ones an admin rejected) are left alone.
    const { data, error } = await admin
      .from("book_places")
      .upsert(batch, { onConflict: "book_id,place_id", ignoreDuplicates: true })
      .select("id");
    if (error) throw error;
    inserted += data.length;
  }
  return { total: rows.length, inserted };
}

async function backfillCovers(admin: Admin) {
  const openLibrary = createOpenLibraryClient({ userAgent });
  const { data: books, error } = await admin
    .from("books")
    .select("id, ol_work_id")
    .not("ol_work_id", "is", null)
    .is("cover_id", null)
    .order("created_at")
    .limit(Number.isFinite(limit) ? limit : 100_000);
  if (error) throw error;
  log(`Cover backfill: ${books.length} books with an Open Library id and no cover (1 req/s)`);

  let found = 0;
  for (const [index, book] of books.entries()) {
    const started = Date.now();
    try {
      const [match] = await openLibrary.search(`key:"/works/${book.ol_work_id}"`, 1);
      if (match?.olWorkId === book.ol_work_id && match.coverId) {
        const { error: updateError } = await admin
          .from("books")
          .update({ cover_id: match.coverId })
          .eq("id", book.id);
        if (updateError) throw updateError;
        found++;
      }
    } catch (coverError) {
      if (!(coverError instanceof ExternalApiError)) throw coverError;
      log(`  ${book.ol_work_id}: ${coverError.message}`);
    }
    if ((index + 1) % 50 === 0) log(`  ${index + 1}/${books.length}, ${found} covers`);
    await sleep(Math.max(0, COVER_INTERVAL_MS - (Date.now() - started)));
  }
  log(`Cover backfill: ${found} covers added`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const started = Date.now();
  log(
    `Seed import${dryRun ? " (dry run)" : ""}${Number.isFinite(limit) ? `, limit ${limit} books` : ""}`,
  );
  const admin = dryRun ? null : adminClient();

  // 1–2. Classes and book ids.
  const bookQids = new Set<string>();
  for (const { qid, count } of await listClasses()) {
    if (bookQids.size >= limit) break;
    const before = bookQids.size;
    await listBookIds(qid, limit, bookQids);
    if (bookQids.size > before || count > 100) {
      log(`  ${qid}: ~${count} works, ${bookQids.size - before} new ids (total ${bookQids.size})`);
    }
  }
  const qids = [...bookQids].sort();
  log(`Book ids: ${qids.length}`);

  // 3. Details.
  const detailRows: Binding[] = [];
  const detailBatches = chunk(qids, DETAIL_BATCH);
  for (const [index, batch] of detailBatches.entries()) {
    detailRows.push(...(await fetchDetails(batch)));
    if ((index + 1) % 10 === 0 || index + 1 === detailBatches.length) {
      log(`  details ${index + 1}/${detailBatches.length} batches, ${detailRows.length} rows`);
    }
  }

  // 4. Place classification flags.
  const placeQids = parseQids(detailRows, "place").sort();
  const flagRows: Binding[] = [];
  const flagBatches = chunk(placeQids, FLAG_BATCH);
  for (const [index, batch] of flagBatches.entries()) {
    // Keyed on the query text, so changing the classification query refetches flags.
    const query = seedPlaceFlagsQuery(batch);
    flagRows.push(...(await sparql(query, `flags/${hash([query])}`)));
    if ((index + 1) % 10 === 0 || index + 1 === flagBatches.length) {
      log(`  place flags ${index + 1}/${flagBatches.length} batches`);
    }
  }

  // 5. Normalize.
  const seed = normalizeSeed(detailRows, parsePlaceFlags(flagRows));
  const byPrecision = Object.groupBy(seed.places, (place) => place.precision);
  log("\nNormalized:");
  log(
    `  books   ${seed.books.length} (${seed.books.filter((b) => b.olWorkId).length} with an Open Library id)`,
  );
  log(
    `  places  ${seed.places.length} (${Object.entries(byPrecision)
      .map(([precision, list]) => `${precision} ${list?.length ?? 0}`)
      .join(", ")})`,
  );
  log(`  links   ${seed.links}`);
  log("  skipped:");
  for (const [reason, count] of Object.entries(seed.skipped)) log(`    ${count} ${reason}`);

  if (!admin) {
    log(`\nDry run: nothing written. ${((Date.now() - started) / 1000).toFixed(0)}s`);
    return;
  }

  // 6. Write.
  log("\nWriting:");
  const placeIds = await upsertPlaces(admin, seed.places);
  log(`  places upserted     ${placeIds.size}`);
  const books = await upsertBooks(admin, seed.books);
  log(`  books inserted      ${books.inserted} (already present: ${books.matched})`);
  const links = await insertLinks(admin, seed.books, books.ids, placeIds);
  log(`  links inserted      ${links.inserted} (already present: ${links.total - links.inserted})`);

  if (args.covers) await backfillCovers(admin);
  log(`\nDone in ${((Date.now() - started) / 1000).toFixed(0)}s`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
