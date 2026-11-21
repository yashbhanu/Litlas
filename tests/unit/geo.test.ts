import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { settingSummary } from "@/lib/books/setting-summary";
import { isSettingStale, SETTING_RECHECK_MS } from "@/lib/db/settings";
import { continentOf, countryName, knownCountryCodes } from "@/lib/geo/continents";
import {
  buildPins,
  buildUserMap,
  computeStats,
  mapBounds,
  type BookPlace,
  type MapBook,
} from "@/lib/geo/map";
import { isAreaPrecision, isPinPrecision } from "@/lib/geo/precision";

const book = (id: string, title = id): MapBook => ({ id, title, authors: [] });
let placeSeq = 0;
const place = (bookId: string, overrides: Partial<BookPlace>): BookPlace => ({
  bookId,
  placeId: `p${++placeSeq}`,
  name: "Somewhere",
  precision: "city",
  countryCode: null,
  source: "wikidata",
  lng: null,
  lat: null,
  ...overrides,
});

const ulysses = book("ulysses", "Ulysses");
const solitude = book("solitude", "One Hundred Years of Solitude");
const nineteen = book("1984", "1984");
const unknown = book("unknown", "Unknown Setting");

const places: BookPlace[] = [
  place("ulysses", { name: "Dublin", countryCode: "IE", lng: -6.26, lat: 53.35 }),
  place("ulysses", {
    name: "Grafton Street",
    precision: "point",
    countryCode: "IE",
    lng: -6.26,
    lat: 53.34,
  }),
  place("ulysses", { name: "#7 Eccles street", precision: "fictional" }),
  place("solitude", { name: "Macondo", precision: "fictional" }),
  place("solitude", { name: "Colombia", precision: "country", countryCode: "CO" }),
  place("1984", { name: "London", countryCode: "GB", lng: -0.13, lat: 51.51 }),
  place("1984", { name: "Oceania", precision: "fictional" }),
  // A place for a book that isn't in the map's book list (e.g. want-to-read).
  place("other", { name: "Paris", countryCode: "FR", lng: 2.35, lat: 48.86 }),
];

describe("precision rules", () => {
  it("pins point/city and shades region/country", () => {
    expect(isPinPrecision("point")).toBe(true);
    expect(isPinPrecision("city")).toBe(true);
    expect(isPinPrecision("region")).toBe(false);
    expect(isAreaPrecision("region")).toBe(true);
    expect(isAreaPrecision("country")).toBe(true);
    expect(isAreaPrecision("fictional")).toBe(false);
    expect(isPinPrecision("fictional")).toBe(false);
  });
});

describe("buildPins", () => {
  it("emits one GeoJSON point per (book, pinnable place) for the given books only", () => {
    const pins = buildPins([ulysses, solitude, nineteen], places);
    expect(pins.type).toBe("FeatureCollection");
    expect(pins.features.map((f) => f.properties.placeName)).toEqual([
      "Dublin",
      "Grafton Street",
      "London",
    ]);
    expect(pins.features[0]).toEqual({
      type: "Feature",
      geometry: { type: "Point", coordinates: [-6.26, 53.35] },
      properties: {
        bookId: "ulysses",
        placeId: places[0]!.placeId,
        title: "Ulysses",
        placeName: "Dublin",
      },
    });
  });

  it("skips pinnable places without coordinates", () => {
    const pins = buildPins(
      [ulysses],
      [place("ulysses", { precision: "city", lng: null, lat: null })],
    );
    expect(pins.features).toEqual([]);
  });
});

describe("computeStats", () => {
  it("counts books, distinct countries and continents, and ranks the top countries", () => {
    const stats = computeStats([ulysses, solitude, nineteen, unknown], places);
    expect(stats).toEqual({
      booksRead: 4,
      countries: 3, // IE, CO, GB (fictional places and other books don't count)
      continents: 2, // Europe, South America
      topCountries: [
        { code: "CO", name: "Colombia", count: 1 },
        { code: "IE", name: "Ireland", count: 1 },
        { code: "GB", name: "United Kingdom", count: 1 },
      ],
    });
  });

  it("counts a country once per book, and caps the top list at 5", () => {
    const books = ["a", "b", "c", "d", "e", "f"].map((id) => book(id));
    const codes = ["IE", "FR", "DE", "ES", "IT", "JP"];
    const many = [
      ...books.map((b, i) => place(b.id, { countryCode: codes[i]!, lng: 0, lat: 0 })),
      // Two more Irish places for book "a" and an Irish setting for "b".
      place("a", { countryCode: "IE", lng: 0, lat: 0 }),
      place("a", { countryCode: "IE", precision: "region" }),
      place("b", { countryCode: "IE", precision: "country" }),
    ];
    const stats = computeStats(books, many);
    expect(stats.countries).toBe(6);
    expect(stats.continents).toBe(2);
    expect(stats.topCountries).toHaveLength(5);
    expect(stats.topCountries[0]).toEqual({ code: "IE", name: "Ireland", count: 2 });
  });

  it("handles an empty shelf", () => {
    expect(computeStats([], [])).toEqual({
      booksRead: 0,
      countries: 0,
      continents: 0,
      topCountries: [],
    });
  });
});

describe("buildUserMap", () => {
  it("builds pins, shaded countries and the list view", () => {
    const map = buildUserMap([ulysses, solitude, nineteen, unknown], places);
    expect(map.countries).toEqual(["CO", "GB", "IE"]);
    expect(map.pins.features).toHaveLength(3);
    expect(map.byCountry.map((group) => [group.name, group.books.map((b) => b.places)])).toEqual([
      ["Colombia", [[]]],
      ["Ireland", [["Dublin", "Grafton Street"]]],
      ["United Kingdom", [["London"]]],
    ]);
    expect(map.fictional).toEqual([
      { bookId: "ulysses", title: "Ulysses", places: ["#7 Eccles street"] },
      { bookId: "solitude", title: "One Hundred Years of Solitude", places: ["Macondo"] },
      { bookId: "1984", title: "1984", places: ["Oceania"] },
    ]);
    expect(map.unplaced).toEqual([{ bookId: "unknown", title: "Unknown Setting" }]);
  });
});

describe("continents", () => {
  it("maps country codes to continents", () => {
    expect(continentOf("IE")).toBe("Europe");
    expect(continentOf("co")).toBe("South America");
    expect(continentOf("JP")).toBe("Asia");
    expect(continentOf("EG")).toBe("Africa");
    expect(continentOf("MX")).toBe("North America");
    expect(continentOf("NZ")).toBe("Oceania");
    expect(continentOf("AQ")).toBe("Antarctica");
    expect(continentOf("ZZ")).toBeNull();
  });

  it("covers every country in the bundled countries.geojson", () => {
    const geo = JSON.parse(
      readFileSync(join(process.cwd(), "public/geo/countries.geojson"), "utf8"),
    ) as { features: { properties: { iso: string } }[] };
    const known = new Set(knownCountryCodes());
    const missing = geo.features.map((f) => f.properties.iso).filter((iso) => !known.has(iso));
    expect(missing).toEqual([]);
    expect(geo.features.length).toBeGreaterThan(200);
  });

  it("names countries in English", () => {
    expect(countryName("IE")).toBe("Ireland");
    expect(countryName("XK")).toBe("Kosovo");
  });
});

describe("isSettingStale", () => {
  const now = Date.parse("2026-11-21T00:00:00Z");
  it("re-checks never-checked and 90-day-old settings only", () => {
    expect(isSettingStale(null, now)).toBe(true);
    expect(isSettingStale(new Date(now - SETTING_RECHECK_MS).toISOString(), now)).toBe(true);
    expect(isSettingStale(new Date(now - SETTING_RECHECK_MS + 60_000).toISOString(), now)).toBe(
      false,
    );
    expect(isSettingStale("not a date", now)).toBe(true);
  });
});

describe("settingSummary", () => {
  it("summarizes a book's settings in one line", () => {
    expect(settingSummary([])).toBe("No setting yet");
    const ulyssesPlaces = places.filter((p) => p.bookId === "ulysses");
    expect(settingSummary(ulyssesPlaces)).toBe(
      "Dublin, Grafton Street · Fictional: #7 Eccles street",
    );
    const many = ["A", "B", "C", "D", "E"].map((name) => place("x", { name }));
    expect(settingSummary(many)).toBe("A, B, C +2 more");
    // Broader places come first.
    const mixed = [
      place("x", { name: "A pub", precision: "point" }),
      place("x", { name: "Dublin", precision: "city" }),
      place("x", { name: "Ireland", precision: "country" }),
    ];
    expect(settingSummary(mixed)).toBe("Ireland, Dublin, A pub");
  });
});

describe("mapBounds", () => {
  it("covers pins and the mainland of shaded countries", () => {
    const pins = buildPins([ulysses], places);
    expect(mapBounds({ type: "FeatureCollection", features: [] }, [])).toBeNull();
    const pinsOnly = mapBounds(pins, [])!;
    expect(pinsOnly[0][0]).toBeCloseTo(-6.26);
    // Adding Colombia stretches the box to South America.
    const withColombia = mapBounds(pins, ["IE", "CO"])!;
    expect(withColombia[0][1]).toBeLessThan(0); // Colombia reaches south of the equator
    expect(withColombia[1][1]).toBeGreaterThan(55); // northern Ireland coast
    // France's box is the mainland, not French Guiana.
    expect(mapBounds({ type: "FeatureCollection", features: [] }, ["FR"])![0][1]).toBeGreaterThan(
      40,
    );
    // Unknown codes are ignored.
    expect(mapBounds({ type: "FeatureCollection", features: [] }, ["ZZ"])).toBeNull();
  });
});
