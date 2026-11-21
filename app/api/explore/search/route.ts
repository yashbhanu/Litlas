import type { NextRequest } from "next/server";
import { PUBLIC_CACHE, validationError } from "@/lib/api";
import { searchPlaces } from "@/lib/db/public";
import { placeSearchQuerySchema } from "@/lib/validation/explore";

/** GET /api/explore/search?q= — places with books whose name matches (jump to a place). */
export async function GET(request: NextRequest) {
  const parsed = placeSearchQuerySchema.safeParse({ q: request.nextUrl.searchParams.get("q") });
  if (!parsed.success) return validationError(parsed.error);
  const results = await searchPlaces(parsed.data.q);
  return Response.json({ results }, { headers: { "Cache-Control": PUBLIC_CACHE } });
}
