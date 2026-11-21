/** Bounding-box helpers for /explore. Client-safe and pure. */

/** [minLng, minLat, maxLng, maxLat] */
export type Bbox = [number, number, number, number];

const MAX_LAT = 85.06; // Web Mercator limit

/**
 * Normalize a map viewport box into 1–2 boxes within [-180, 180]. MapLibre reports
 * longitudes beyond ±180 when the world wraps, and a box crossing the antimeridian is
 * split in two. A box 360° wide or more covers the whole world.
 */
export function normalizeBbox([minLng, minLat, maxLng, maxLat]: Bbox): Bbox[] {
  const south = Math.max(-90, Math.min(minLat, maxLat));
  const north = Math.min(90, Math.max(minLat, maxLat));
  if (maxLng - minLng >= 360) return [[-180, south, 180, north]];
  const shift = Math.floor((minLng + 180) / 360) * 360;
  const west = minLng - shift;
  const east = maxLng - shift;
  if (east <= 180) return [[west, south, east, north]];
  return [
    [west, south, 180, north],
    [-180, south, east - 360, north],
  ];
}

/** Grid step (degrees) used to snap requests, so nearby viewports share a cache key. */
export function gridStep(zoom: number): number {
  return 90 / 2 ** Math.max(0, Math.floor(zoom));
}

const round = (n: number) => Math.round(n * 1e6) / 1e6;

/**
 * The box to request for a viewport: padded by half its size on every side, then
 * snapped outward to the zoom's grid. Panning within it needs no new request.
 */
export function requestBbox([minLng, minLat, maxLng, maxLat]: Bbox, zoom: number): Bbox {
  const step = gridStep(zoom);
  const padLng = (maxLng - minLng) / 2;
  const padLat = (maxLat - minLat) / 2;
  const snapDown = (n: number) => round(Math.floor(n / step) * step);
  const snapUp = (n: number) => round(Math.ceil(n / step) * step);
  const west = snapDown(minLng - padLng);
  const east = snapUp(maxLng + padLng);
  if (east - west >= 360) return [-180, -MAX_LAT, 180, MAX_LAT];
  return [
    west,
    Math.max(-MAX_LAT, snapDown(minLat - padLat)),
    east,
    Math.min(MAX_LAT, snapUp(maxLat + padLat)),
  ];
}

/** Does `outer` fully contain `inner`? */
export function bboxContains(outer: Bbox, inner: Bbox): boolean {
  return (
    outer[0] <= inner[0] && outer[1] <= inner[1] && outer[2] >= inner[2] && outer[3] >= inner[3]
  );
}

export function formatBbox(bbox: Bbox): string {
  return bbox.map((n) => round(n)).join(",");
}
