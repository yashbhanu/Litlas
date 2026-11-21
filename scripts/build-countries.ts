/**
 * Builds public/geo/countries.geojson from Natural Earth admin-0 countries: the 1:110m
 * shapes, plus 1:50m shapes for small countries that 1:110m leaves out (Singapore,
 * Malta, …). Keeps only an ISO 3166-1 alpha-2 code and a name per feature and rounds
 * coordinates to 2 decimals (~1 km) to keep the file small.
 *
 * Run: node scripts/build-countries.ts
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const BASE = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson";
const SOURCES = [
  `${BASE}/ne_110m_admin_0_countries.geojson`,
  `${BASE}/ne_50m_admin_0_countries.geojson`,
];
const OUT = join(import.meta.dirname, "..", "public", "geo", "countries.geojson");
const BOUNDS_OUT = join(import.meta.dirname, "..", "lib", "geo", "country-bounds.json");

type Position = [number, number];
type Ring = Position[];
type Geometry =
  { type: "Polygon"; coordinates: Ring[] } | { type: "MultiPolygon"; coordinates: Ring[][] };
interface SourceFeature {
  properties: Record<string, unknown>;
  geometry: Geometry;
}

const round = (n: number) => Math.round(n * 100) / 100;

function simplifyRing(ring: Ring): Ring | null {
  const out: Ring = [];
  for (const [x, y] of ring) {
    const point: Position = [round(x), round(y)];
    const last = out.at(-1);
    if (!last || last[0] !== point[0] || last[1] !== point[1]) out.push(point);
  }
  // A valid linear ring needs at least 4 positions (closed triangle).
  return out.length >= 4 ? out : null;
}

function simplifyPolygon(rings: Ring[]): Ring[] | null {
  const [outer, ...holes] = rings.map(simplifyRing);
  if (!outer) return null;
  return [outer, ...holes.filter((ring): ring is Ring => ring !== null)];
}

function simplifyGeometry(geometry: Geometry): Geometry | null {
  if (geometry.type === "Polygon") {
    const polygon = simplifyPolygon(geometry.coordinates);
    return polygon ? { type: "Polygon", coordinates: polygon } : null;
  }
  const polygons = geometry.coordinates
    .map(simplifyPolygon)
    .filter((polygon): polygon is Ring[] => polygon !== null);
  return polygons.length ? { type: "MultiPolygon", coordinates: polygons } : null;
}

async function download(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download failed: HTTP ${response.status} ${url}`);
  return ((await response.json()) as { features: SourceFeature[] }).features;
}

const byCode = new Map<string, { name: string; polygons: Ring[][]; scale: number }>();
for (const [scale, url] of SOURCES.entries()) {
  for (const feature of await download(url)) addFeature(feature, scale);
}

/** Merges features sharing an ISO code; a finer scale only fills codes still missing. */
function addFeature(feature: SourceFeature, scale: number) {
  // ISO_A2 is "-99" for France, Norway and Kosovo; ISO_A2_EH fills those in.
  const code = String(feature.properties.ISO_A2_EH ?? feature.properties.ISO_A2);
  if (!/^[A-Z]{2}$/.test(code)) return;
  const entry = byCode.get(code);
  if (entry && entry.scale !== scale) return;
  const geometry = simplifyGeometry(feature.geometry);
  if (!geometry) return;
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  if (entry) entry.polygons.push(...polygons);
  else byCode.set(code, { name: String(feature.properties.NAME), polygons, scale });
}

const features = [...byCode.entries()]
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([iso, { name, polygons }]) => ({
    type: "Feature",
    properties: { iso, name },
    geometry:
      polygons.length === 1
        ? { type: "Polygon", coordinates: polygons[0] }
        : { type: "MultiPolygon", coordinates: polygons },
  }));

const json = JSON.stringify({ type: "FeatureCollection", features });
writeFileSync(OUT, json);
console.log(`Wrote ${features.length} countries, ${(json.length / 1024).toFixed(0)} KB → ${OUT}`);

// Bounding boxes [minLng, minLat, maxLng, maxLat] of each country's largest polygon (its
// mainland: France without French Guiana, the US without Alaska) so maps can fit shaded
// countries in view without loading the shapes.
const ringArea = (ring: Ring) =>
  Math.abs(
    ring.reduce((sum, [x1, y1], i) => {
      const [x2, y2] = ring[(i + 1) % ring.length]!;
      return sum + x1 * y2 - x2 * y1;
    }, 0),
  ) / 2;
const bounds: Record<string, [number, number, number, number]> = {};
for (const [iso, { polygons }] of byCode) {
  const mainland = polygons.reduce((a, b) => (ringArea(b[0]!) > ringArea(a[0]!) ? b : a));
  const lngs = mainland[0]!.map(([lng]) => lng);
  const lats = mainland[0]!.map(([, lat]) => lat);
  bounds[iso] = [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)];
}
writeFileSync(BOUNDS_OUT, `${JSON.stringify(bounds)}\n`);
console.log(`Wrote ${Object.keys(bounds).length} country bounds → ${BOUNDS_OUT}`);
