import { getVersion, setWorkerUrl, type Map as MaplibreMap } from "maplibre-gl";

// Bundlers don't emit MapLibre's worker file; scripts/copy-maplibre-worker.mjs copies it
// into public/ on install under a versioned name. Import this module for its side effect
// before creating a map.
setWorkerUrl(`/maplibre/maplibre-gl-worker-${getVersion()}.mjs`);

/** Map colours (match the design tokens in globals.css). */
export const MAP_COLORS = {
  /** Shaded / selected countries. */
  country: "#0f766e",
  /** A book's city or place. */
  pin: "#e07a1f",
  /** Pin highlight (hover / selected). */
  highlight: "#0f766e",
  /** Clusters of books. */
  cluster: "#1f2937",
  water: "#d6e2ec",
  land: "#fbfbf9",
} as const;

/**
 * Lighten the basemap toward the mockups: pale blue water, near-white land. Only touches
 * layers that exist, so any OpenFreeMap style still works.
 */
export function tuneBasemap(map: MaplibreMap) {
  const fill = (layer: string, color: string) => {
    if (map.getLayer(layer)) map.setPaintProperty(layer, "fill-color", color);
  };
  if (map.getLayer("background")) {
    map.setPaintProperty("background", "background-color", MAP_COLORS.land);
  }
  fill("water", MAP_COLORS.water);
  fill("park", "#eef2ec");
  fill("landuse_residential", "#f4f4f1");
}
