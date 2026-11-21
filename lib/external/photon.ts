import "server-only";

import { z } from "zod";
import type { PlaceCandidate } from "@/lib/locations/types";
import { fetchJson, type FetchFn } from "./http";

const BASE_URL = "https://photon.komoot.io/api/";
const SERVICE = "photon";

const featureSchema = z.object({
  geometry: z.object({
    type: z.literal("Point"),
    coordinates: z.tuple([z.number(), z.number()]),
  }),
  properties: z.object({
    osm_type: z.enum(["N", "W", "R"]),
    osm_id: z.number().int(),
    name: z.string().min(1),
    type: z.string().optional(),
    countrycode: z.string().optional(),
    country: z.string().optional(),
    state: z.string().optional(),
    county: z.string().optional(),
    city: z.string().optional(),
  }),
});

/** Features are validated one by one so one odd result doesn't fail the search. */
const responseSchema = z.object({ features: z.array(z.unknown()) });

const COUNTRY_TYPES = new Set(["country"]);
const REGION_TYPES = new Set(["state", "county", "region", "province"]);

/** Turn Photon GeoJSON features into picker candidates (pure, unit tested). */
export function normalizePhotonFeatures(features: unknown[]): PlaceCandidate[] {
  const results: PlaceCandidate[] = [];
  const seen = new Set<string>();
  for (const feature of features) {
    const parsed = featureSchema.safeParse(feature);
    if (!parsed.success) continue;
    const { properties: p, geometry } = parsed.data;
    const osmId = `${p.osm_type}${p.osm_id}`;
    if (seen.has(osmId)) continue;
    seen.add(osmId);
    const type = p.type ?? "";
    const countryCode =
      p.countrycode && /^[A-Za-z]{2}$/.test(p.countrycode) ? p.countrycode.toUpperCase() : null;
    const context = [p.city, p.county, p.state, p.country].filter(
      (part, index, all): part is string =>
        !!part && part !== p.name && all.indexOf(part) === index,
    );
    results.push({
      osmId,
      name: p.name,
      description: context.join(", "),
      countryCode,
      lng: geometry.coordinates[0],
      lat: geometry.coordinates[1],
      suggestedPrecision: COUNTRY_TYPES.has(type)
        ? "country"
        : REGION_TYPES.has(type)
          ? "region"
          : "city",
    });
  }
  return results;
}

export interface PhotonClientOptions {
  userAgent: string;
  fetch?: FetchFn;
  sleep?: (ms: number) => Promise<void>;
}

export function createPhotonClient(options: PhotonClientOptions) {
  const http = { service: SERVICE, ...options };
  async function search(query: string, limit = 6): Promise<PlaceCandidate[]> {
    const url = new URL(BASE_URL);
    url.searchParams.set("q", query);
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("lang", "en");
    const body = await fetchJson(url.toString(), responseSchema, http);
    return body ? normalizePhotonFeatures(body.features) : [];
  }
  return { search };
}

export type PhotonClient = ReturnType<typeof createPhotonClient>;
