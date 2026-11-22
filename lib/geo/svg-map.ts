/**
 * A tiny equirectangular world projection for server-rendered maps (share images, the
 * landing page). Pure, no dependencies. Latitudes are cropped to 84°N–58°S (Antarctica
 * isn't drawn). Country paths are pre-projected by scripts/build-countries.mts.
 */

export const WORLD_SVG = { width: 1000, height: 394, north: 84, south: -58 } as const;

export function projectLngLat(lng: number, lat: number): [number, number] {
  const { width, height, north, south } = WORLD_SVG;
  const x = ((lng + 180) / 360) * width;
  const y = ((north - Math.max(south, Math.min(north, lat))) / (north - south)) * height;
  return [x, y];
}
