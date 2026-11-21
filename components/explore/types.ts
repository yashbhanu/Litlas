import type { LngLatBounds } from "@/lib/geo/map";

export type ExploreSelection =
  | { kind: "place"; placeId: string; name: string; countryCode: string | null }
  | { kind: "country"; code: string; name: string };

/** Where to move the map (from search). `id` makes repeated picks re-trigger. */
export type ExploreFocus =
  | { kind: "point"; center: [number, number]; zoom: number; id: number | string }
  | { kind: "bounds"; bounds: LngLatBounds; id: number | string };
