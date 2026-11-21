import { describe, expect, it } from "vitest";
import { createPhotonClient, normalizePhotonFeatures } from "@/lib/external/photon";
import {
  moderateLocationSchema,
  placeSearchSchema,
  suggestLocationSchema,
} from "@/lib/validation/locations";
import { fixtureFetch, loadFixture } from "./helpers/fixture-fetch";

const features = (name: string) =>
  (loadFixture(`photon/${name}.json`) as { features: unknown[] }).features;

describe("normalizePhotonFeatures (recorded responses)", () => {
  it("Bogota: the Colombian city first, as a city with an OSM relation id", () => {
    const [first, second, third] = normalizePhotonFeatures(features("bogota"));
    expect(first).toEqual({
      osmId: "R7426387",
      name: "Bogota",
      description: "Bogota, Capital District, Colombia",
      countryCode: "CO",
      lng: -74.0836331,
      lat: 4.6533817,
      suggestedPrecision: "city",
    });
    expect(second).toMatchObject({ countryCode: "US", suggestedPrecision: "city" });
    // A state preselects "region".
    expect(third).toMatchObject({ name: "Bogota, Capital District", suggestedPrecision: "region" });
  });

  it("Colombia: the country result preselects 'country'", () => {
    expect(normalizePhotonFeatures(features("colombia"))[0]).toMatchObject({
      osmId: "R120027",
      countryCode: "CO",
      suggestedPrecision: "country",
      description: "",
    });
  });

  it("skips malformed features and duplicates", () => {
    const [good] = features("reykjavik");
    expect(normalizePhotonFeatures([good, good, { properties: {} }, "x"])).toHaveLength(1);
  });

  it("client sends our User-Agent and asks for English names", async () => {
    const { fetch, calls } = fixtureFetch([
      [(url) => url.hostname === "photon.komoot.io", "photon/reykjavik.json"],
    ]);
    const results = await createPhotonClient({ userAgent: "LWM/test", fetch }).search("Reykjavik");
    expect(results[0]).toMatchObject({ name: "Reykjavik", countryCode: "IS" });
    const url = new URL(calls[0]!.url);
    expect(url.searchParams.get("q")).toBe("Reykjavik");
    expect(url.searchParams.get("lang")).toBe("en");
    expect(calls[0]!.headers["user-agent"]).toBe("LWM/test");
  });
});

describe("suggestLocationSchema", () => {
  it("accepts a real place, a country and a fictional place", () => {
    expect(
      suggestLocationSchema.parse({
        precision: "city",
        name: "Bogota",
        osmId: "R7426387",
        countryCode: "co",
        lng: -74.08,
        lat: 4.65,
      }),
    ).toMatchObject({ precision: "city", countryCode: "CO" });
    expect(
      suggestLocationSchema.parse({ precision: "country", name: "Colombia", countryCode: "CO" }),
    ).toEqual({
      precision: "country",
      name: "Colombia",
      countryCode: "CO",
    });
    expect(suggestLocationSchema.parse({ precision: "fictional", name: "  Macondo " })).toEqual({
      precision: "fictional",
      name: "Macondo",
    });
  });

  it.each([
    { precision: "point", name: "X", osmId: "N1", lng: 0, lat: 0 }, // point isn't offered
    { precision: "city", name: "X", osmId: "123", lng: 0, lat: 0 },
    { precision: "city", name: "X", osmId: "N1", lng: 200, lat: 0 },
    { precision: "country", name: "X" },
    { precision: "fictional", name: "" },
    { precision: "fictional", name: "x".repeat(121) },
  ])("rejects %o", (input) => {
    expect(suggestLocationSchema.safeParse(input).success).toBe(false);
  });
});

describe("other location schemas", () => {
  it("requires 3+ characters for place search", () => {
    expect(placeSearchSchema.safeParse({ q: "ab" }).success).toBe(false);
    expect(placeSearchSchema.safeParse({ q: "abc" }).success).toBe(true);
  });

  it("moderation actions", () => {
    expect(moderateLocationSchema.parse({ action: "approve" })).toEqual({ action: "approve" });
    expect(moderateLocationSchema.safeParse({ action: "merge" }).success).toBe(false);
    expect(moderateLocationSchema.safeParse({ action: "delete" }).success).toBe(false);
  });
});
