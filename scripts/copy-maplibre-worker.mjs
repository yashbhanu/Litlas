/**
 * maplibre-gl 6 loads its web worker from a file next to its own module
 * (maplibre-gl-worker.mjs), which bundlers don't emit. Copy it into public/ under a
 * versioned name; the map points MapLibre at it with setWorkerUrl(). Runs on postinstall.
 */
import { copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const pkgPath = require.resolve("maplibre-gl/package.json");
const { version } = JSON.parse(readFileSync(pkgPath, "utf8"));
const outDir = join(import.meta.dirname, "..", "public", "maplibre");

mkdirSync(outDir, { recursive: true });
for (const file of readdirSync(outDir)) rmSync(join(outDir, file));
const target = join(outDir, `maplibre-gl-worker-${version}.mjs`);
copyFileSync(join(dirname(pkgPath), "dist", "maplibre-gl-worker.mjs"), target);
console.log(`Copied MapLibre worker ${version} → public/maplibre/`);
