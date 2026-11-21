import type { NextRequest } from "next/server";
import { PUBLIC_CACHE, validationError } from "@/lib/api";
import { searchBooks, searchPlaces } from "@/lib/db/public";
import { placeSearchQuerySchema } from "@/lib/validation/explore";

/** GET /api/search?q= — header search: places with books, and books by title. */
export async function GET(request: NextRequest) {
  const parsed = placeSearchQuerySchema.safeParse({ q: request.nextUrl.searchParams.get("q") });
  if (!parsed.success) return validationError(parsed.error);
  const [places, books] = await Promise.all([
    searchPlaces(parsed.data.q),
    searchBooks(parsed.data.q),
  ]);
  return Response.json(
    { places: places.filter((p) => p.precision !== "country").slice(0, 5), books },
    { headers: { "Cache-Control": PUBLIC_CACHE } },
  );
}
