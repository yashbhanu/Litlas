import { describe, expect, it } from "vitest";
import type { Binding } from "@/lib/external/wikidata";
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
} from "@/lib/seed/wikidata-seed";
import { loadFixture } from "./helpers/fixture-fetch";

/** Recorded rows for 7 books chosen for their edge cases (see fixture). */
const sample = loadFixture("wikidata/seed-sample.json") as { details: Binding[]; flags: Binding[] };

describe("seed queries", () => {
  it("pages book ids per class and batches details/flags with VALUES", () => {
    expect(seedBookIdsQuery("Q7725634", 5000, 10000)).toContain("wdt:P31 wd:Q7725634");
    expect(seedBookIdsQuery("Q7725634", 5000, 10000)).toMatch(/LIMIT 5000 OFFSET 10000$/);
    expect(seedBookDetailsQuery(["Q1", "Q2"])).toContain("VALUES ?book { wd:Q1 wd:Q2 }");
    expect(seedPlaceFlagsQuery(["Q84"])).toContain("wd:Q5107"); // continent check
    expect(seedClassesQuery()).toContain("wd:Q7725634");
    expect(seedClassesQuery()).toContain("FILTER NOT EXISTS { ?cls wdt:P279* wd:Q11424 }");
  });

  it("refuses ids that aren't QIDs (no SPARQL injection)", () => {
    expect(() => seedBookDetailsQuery(["Q1 } ?x ?y ?z . {"])).toThrow();
    expect(() => seedBookIdsQuery("wd:Q1", 10, 0)).toThrow();
  });
});

describe("parsing helpers", () => {
  it("parses classes, qids and flags", () => {
    const uri = (q: string) => ({ type: "uri", value: `http://www.wikidata.org/entity/${q}` });
    expect(
      parseClasses([{ cls: uri("Q7725634"), n: { type: "literal", value: "12506" } }]),
    ).toEqual([{ qid: "Q7725634", count: 12506 }]);
    expect(
      parseQids([{ book: uri("Q1") }, { book: uri("Q1") }, { book: uri("Q2") }], "book"),
    ).toEqual(["Q1", "Q2"]);
    const flags = parsePlaceFlags(sample.flags);
    expect(flags.get("Q15")).toMatchObject({ isContinent: true });
    expect(flags.get("Q84")).toMatchObject({ isSettlement: true, isCountry: false });
  });

  it("chunks arrays", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 3)).toEqual([]);
  });
});

describe("normalizeSeed (recorded sample)", () => {
  const seed = normalizeSeed(sample.details, parsePlaceFlags(sample.flags));
  const book = (qid: string) => seed.books.find((b) => b.wikidataId === qid);
  const place = (qid: string) => seed.places.find((p) => p.wikidataId === qid);

  it("keeps Open Library work ids and drops edition ids", () => {
    expect(book("Q4410342")).toEqual({
      wikidataId: "Q4410342",
      title: "Kraken",
      authors: ["China Miéville"],
      olWorkId: "OL14990804W",
      placeIds: ["Q21", "Q84"], // England, London
    });
    // P648 "OL8984140M" is an edition, not a work.
    expect(book("Q82530")?.olWorkId).toBeNull();
  });

  it("dedupes co-authors and places across rows", () => {
    // First Frontier: two authors, but only an unplaceable (Earth) and a fictional place.
    expect(book("Q54806996")).toMatchObject({
      authors: ["Diane Carey", "James I. Kirkland"],
      placeIds: ["Q55440409"],
    });
  });

  it("classifies places with the same rules as the per-book lookup", () => {
    expect(place("Q84")).toMatchObject({ name: "London", precision: "city", countryCode: "GB" });
    expect(place("Q21")).toMatchObject({
      name: "England",
      precision: "country",
      countryCode: "GB",
      coordinates: null,
    });
    expect(place("Q39")).toMatchObject({
      name: "Switzerland",
      precision: "country",
      countryCode: "CH",
    });
    expect(place("Q12745")).toMatchObject({ name: "Savoie", precision: "point" });
    expect(place("Q55440409")).toMatchObject({
      name: "Gateway",
      precision: "fictional",
      coordinates: null,
    });
  });

  it("drops continents, unplaceable items and books without an English title", () => {
    for (const qid of ["Q15", "Q46", "Q1", "Q2"]) expect(place(qid)).toBeUndefined(); // Africa, Europe, universe, Earth
    expect(book("Q3819297")).toBeUndefined(); // no English/mul title
    expect(seed.skipped).toEqual({
      "book without an English title": 1,
      "place without a label, coordinates or country, or a continent": 4,
    });
  });

  it("only keeps places used by an imported book, and counts links", () => {
    const used = new Set(seed.books.flatMap((b) => b.placeIds));
    expect(seed.places.every((p) => used.has(p.wikidataId))).toBe(true);
    expect(seed.links).toBe(seed.books.reduce((n, b) => n + b.placeIds.length, 0));
    expect(seed.books).toHaveLength(5); // 6 books in the sample, one without a title
  });
});
