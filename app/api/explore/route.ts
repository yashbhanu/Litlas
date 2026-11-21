import type { NextRequest } from "next/server";
import { PUBLIC_CACHE, validationError } from "@/lib/api";
import { explorePlaces } from "@/lib/db/public";
import { normalizeBbox } from "@/lib/geo/bbox";
import { exploreQuerySchema } from "@/lib/validation/explore";

/**
 * GET /api/explore?bbox=minLng,minLat,maxLng,maxLat&zoom= — GeoJSON of places with
 * approved books inside the box (split at the antimeridian), most-read first, capped at
 * 2,000 features. `zoom` is part of the cache key; the client snaps boxes to a grid
 * that depends on it.
 */
export async function GET(request: NextRequest) {
  const params = Object.fromEntries(request.nextUrl.searchParams);
  const parsed = exploreQuerySchema.safeParse(params);
  if (!parsed.success) return validationError(parsed.error);

  const result = await explorePlaces(normalizeBbox(parsed.data.bbox));
  return Response.json(result, { headers: { "Cache-Control": PUBLIC_CACHE } });
}
