import type { NextRequest } from "next/server";
import { apiError, validationError } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { ExternalApiError } from "@/lib/external/http";
import { searchPlacesCached } from "@/lib/external/photon.server";
import { placeSearchSchema } from "@/lib/validation/locations";

/** GET /api/places/search?q= — Photon place autocomplete for the PlacePicker (signed in). */
export async function GET(request: NextRequest) {
  if (!(await getSessionUser())) return apiError("unauthorized", "Sign in to search places.");

  const parsed = placeSearchSchema.safeParse({ q: request.nextUrl.searchParams.get("q") ?? "" });
  if (!parsed.success) return validationError(parsed.error);

  try {
    const results = await searchPlacesCached(parsed.data.q.toLowerCase());
    return Response.json({ results });
  } catch (error) {
    if (!(error instanceof ExternalApiError)) throw error;
    console.error(error);
    return apiError("upstream_error", "Place search is unavailable right now. Try again shortly.");
  }
}
