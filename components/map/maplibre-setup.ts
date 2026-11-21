import { getVersion, setWorkerUrl } from "maplibre-gl";

// Bundlers don't emit MapLibre's worker file; scripts/copy-maplibre-worker.mjs copies it
// into public/ on install under a versioned name. Import this module for its side effect
// before creating a map.
setWorkerUrl(`/maplibre/maplibre-gl-worker-${getVersion()}.mjs`);

export const MAP_COLORS = {
  country: "#0d9488",
  pin: "#1d4ed8",
  highlight: "#f59e0b",
  cluster: "#1e40af",
} as const;
