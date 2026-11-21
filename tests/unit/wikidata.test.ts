import { describe, expect, it } from "vitest";
import { ExternalApiError } from "@/lib/external/http";
import {
  bookByTitleAuthorQuery,
  createWikidataClient,
  narrativeLocationsQuery,
  parseNarrativeLocations,
  parseSingleBook,
  parseWktPoint,
  qidFromUri,
  sparqlString,
} from "@/lib/external/wikidata";
import { classifyPlace, type PlaceFacts } from "@/lib/geo/precision";
import { fixtureFetch, loadFixture } from "./helpers/fixture-fetch";

const UA = "LiteraryWorldMap/test";
const noSleep = async () => {};

type Bindings = Parameters<typeof parseNarrativeLocations>[0];
const bindings = (fixture: string) =>
  (loadFixture(`wikidata/${fixture}.json`) as { results: { bindings: Bindings } }).results.bindings;

/** Match a SPARQL request by a fragment of its query text. */
const queryContains = (fragment: string) => (url: URL) =>
  url.hostname === "query.wikidata.org" && (url.searchParams.get("query") ?? "").includes(fragment);

describe("classifyPlace", () => {
  const base: PlaceFacts = {
    isFictional: false,
    isCountry: false,
    isSettlement: false,
    isFirstLevelRegion: false,
    hasCoordinates: false,
    countryCode: null,
  };

  it("applies the precision rules in order", () => {
    expect(classifyPlace({ ...base, isFictional: true, hasCoordinates: true })).toBe("fictional");
    expect(classifyPlace({ ...base, isCountry: true, countryCode: "CO" })).toBe("country");
    expect(classifyPlace({ ...base, isFirstLevelRegion: true, countryCode: "US" })).toBe("region");
    expect(classifyPlace({ ...base, hasCoordinates: true, isSettlement: true })).toBe("city");
    expect(classifyPlace({ ...base, hasCoordinates: true })).toBe("point");
    expect(classifyPlace({ ...base, countryCode: "IE" })).toBe("region");
  });

  it("returns null for places that can't be put on a map", () => {
    expect(classifyPlace(base)).toBeNull();
    expect(classifyPlace({ ...base, isCountry: true })).toBeNull();
    expect(classifyPlace({ ...base, isFirstLevelRegion: true })).toBeNull();
  });
});

describe("parsing helpers", () => {
  it("parses WKT points and rejects other globes and bad values", () => {
    expect(parseWktPoint("Point(-6.260277777 53.349722222)")).toEqual([-6.260277777, 53.349722222]);
    expect(parseWktPoint("Point(10 -5)")).toEqual([10, -5]);
    expect(parseWktPoint("<http://www.wikidata.org/entity/Q405> Point(1 2)")).toBeNull();
    expect(parseWktPoint("Point(200 10)")).toBeNull();
    expect(parseWktPoint("garbage")).toBeNull();
  });

  it("extracts QIDs from entity URIs", () => {
    expect(qidFromUri("http://www.wikidata.org/entity/Q1761")).toBe("Q1761");
    expect(qidFromUri("http://www.wikidata.org/entity/statement/X")).toBeNull();
  });

  it("escapes SPARQL string literals", () => {
    expect(sparqlString('He said "hi"\\')).toBe('"He said \\"hi\\"\\\\"');
    expect(bookByTitleAuthorQuery('The "Book"', "A. Author")).toContain('"The \\"Book\\""@en');
  });

  it("refuses to build a location query from an invalid QID", () => {
    expect(() => narrativeLocationsQuery("Q1 } DROP")).toThrow();
  });

  it("accepts only a single unambiguous book", () => {
    expect(parseSingleBook(bindings("book-ol-OL86318W"))).toBe("Q6511");
    expect(parseSingleBook(bindings("book-ol-OL999999999W"))).toBeNull();
    const two = [
      { book: { type: "uri", value: "http://www.wikidata.org/entity/Q1" } },
      { book: { type: "uri", value: "http://www.wikidata.org/entity/Q2" } },
    ];
    expect(parseSingleBook(two)).toBeNull();
  });
});

describe("parseNarrativeLocations (recorded responses)", () => {
  it("Ulysses: Dublin is a city pin in Ireland; unplaceable and fictional items handled", () => {
    const places = parseNarrativeLocations(bindings("locations-Q6511-ulysses"));
    const dublin = places.find((place) => place.wikidataId === "Q1761");
    expect(dublin).toEqual({
      wikidataId: "Q1761",
      name: "Dublin",
      precision: "city",
      countryCode: "IE",
      coordinates: [-6.260277777, 53.349722222],
    });
    // Landmarks with coordinates but no settlement class are points.
    expect(places.find((place) => place.name === "Grafton Street")?.precision).toBe("point");
    // A newspaper with no coordinates or country can't be placed and is dropped.
    expect(places.some((place) => place.name === "Freeman's Journal")).toBe(false);
    // Fictional places never carry coordinates.
    const eccles = places.find((place) => place.name === "#7 Eccles street");
    expect(eccles).toMatchObject({ precision: "fictional", coordinates: null });
    // Every real place is in Ireland.
    for (const place of places.filter((p) => p.precision !== "fictional")) {
      expect(place.countryCode).toBe("IE");
    }
  });

  it("One Hundred Years of Solitude: only Macondo, a fictional city with no country", () => {
    expect(parseNarrativeLocations(bindings("locations-Q178869-solitude"))).toEqual([
      {
        wikidataId: "Q934381",
        name: "Macondo",
        precision: "fictional",
        countryCode: null,
        coordinates: null,
      },
    ]);
  });

  it("1984: London pin plus fictional Oceania", () => {
    const places = parseNarrativeLocations(bindings("locations-Q208460-1984"));
    expect(places.map((place) => [place.name, place.precision, place.countryCode])).toEqual([
      ["London", "city", "GB"],
      ["Oceania", "fictional", null],
    ]);
  });

  it("groups duplicate rows per place and prefers a country's own ISO code", () => {
    const uri = (id: string) => ({ type: "uri", value: `http://www.wikidata.org/entity/${id}` });
    const lit = (value: string) => ({ type: "literal", value });
    const rows: Bindings = [
      {
        place: uri("Q739"),
        placeLabel: lit("Colombia"),
        coord: lit("Point(-73 4)"),
        countryCode: lit("CO"),
        ownCode: lit("CO"),
        isCountry: lit("true"),
      },
      {
        place: uri("Q739"),
        placeLabel: lit("Colombia"),
        coord: lit("Point(-74 5)"),
        countryCode: lit("CO"),
        ownCode: lit("CO"),
        isCountry: lit("true"),
      },
      // England: instance of country, no own ISO code, P17 → GB.
      {
        place: uri("Q21"),
        placeLabel: lit("England"),
        coord: lit("Point(-1 52)"),
        countryCode: lit("GB"),
        isCountry: lit("true"),
      },
      // No English label: the label service returns the QID.
      { place: uri("Q999"), placeLabel: lit("Q999"), countryCode: lit("FR") },
    ];
    expect(parseNarrativeLocations(rows)).toEqual([
      {
        wikidataId: "Q739",
        name: "Colombia",
        precision: "country",
        countryCode: "CO",
        coordinates: null,
      },
      {
        wikidataId: "Q21",
        name: "England",
        precision: "country",
        countryCode: "GB",
        coordinates: null,
      },
    ]);
  });
});

describe("createWikidataClient", () => {
  it("resolves a book by Open Library id and fetches its locations, sending our UA", async () => {
    const { fetch, calls } = fixtureFetch([
      [queryContains('wdt:P648 "OL86318W"'), "wikidata/book-ol-OL86318W.json"],
      [queryContains("wd:Q6511 wdt:P840"), "wikidata/locations-Q6511-ulysses.json"],
    ]);
    const client = createWikidataClient({ userAgent: UA, fetch, sleep: noSleep });

    const qid = await client.findBookId({
      olWorkId: "OL86318W",
      title: "Ulysses",
      authors: ["James Joyce"],
    });
    expect(qid).toBe("Q6511");
    const places = await client.getNarrativeLocations("Q6511");
    expect(places.map((place) => place.name)).toContain("Dublin");

    expect(calls).toHaveLength(2);
    for (const call of calls) {
      expect(call.headers["user-agent"]).toBe(UA);
      expect(call.headers.accept).toBe("application/sparql-results+json");
    }
  });

  it("falls back to an exact title + author match when the Open Library id is unknown", async () => {
    const { fetch, calls } = fixtureFetch([
      [queryContains("wdt:P648"), "wikidata/book-ol-OL999999999W.json"],
      [
        queryContains('"One Hundred Years of Solitude"@en'),
        "wikidata/book-title-one-hundred-years.json",
      ],
    ]);
    const client = createWikidataClient({ userAgent: UA, fetch, sleep: noSleep });
    const qid = await client.findBookId({
      olWorkId: "OL999999999W",
      title: "One Hundred Years of Solitude",
      authors: ["Gabriel García Márquez"],
    });
    expect(qid).toBe("Q178869");
    expect(calls).toHaveLength(2);
  });

  it("returns null without a title query when there is no author", async () => {
    const { fetch, calls } = fixtureFetch([
      [queryContains("wdt:P648"), "wikidata/book-ol-OL999999999W.json"],
    ]);
    const client = createWikidataClient({ userAgent: UA, fetch, sleep: noSleep });
    expect(
      await client.findBookId({ olWorkId: "OL999999999W", title: "X", authors: [] }),
    ).toBeNull();
    expect(calls).toHaveLength(1);
  });

  it("retries 429/5xx with exponential backoff, then gives up", async () => {
    const delays: number[] = [];
    const { fetch, calls } = fixtureFetch([[() => true, 503]]);
    const client = createWikidataClient({
      userAgent: UA,
      fetch,
      sleep: async (ms) => {
        delays.push(ms);
      },
    });
    await expect(client.getNarrativeLocations("Q6511")).rejects.toBeInstanceOf(ExternalApiError);
    expect(calls).toHaveLength(4);
    expect(delays).toEqual([1000, 2000, 4000]);
  });

  it("serializes queries: a second call starts only after the first finishes", async () => {
    const events: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    let call = 0;
    const fetch: typeof globalThis.fetch = async () => {
      const n = ++call;
      events.push(`start ${n}`);
      if (n === 1) await gate;
      events.push(`end ${n}`);
      return Response.json(loadFixture("wikidata/locations-Q178869-solitude.json"));
    };
    const client = createWikidataClient({ userAgent: UA, fetch, sleep: noSleep });

    const first = client.getNarrativeLocations("Q178869");
    const second = client.getNarrativeLocations("Q178869");
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(events).toEqual(["start 1"]);
    release();
    await Promise.all([first, second]);
    expect(events).toEqual(["start 1", "end 1", "start 2", "end 2"]);
  });
});
