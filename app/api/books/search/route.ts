import type { NextRequest } from "next/server";
import { apiError, validationError } from "@/lib/api";
import { ExternalApiError } from "@/lib/external/http";
import { searchBooksCached } from "@/lib/external/openlibrary.server";
import { bookSearchQuerySchema, type BookSearchResponse } from "@/lib/validation/books";

/** GET /api/books/search?q= — public proxy for Open Library search. */
export async function GET(request: NextRequest) {
  const parsed = bookSearchQuerySchema.safeParse({
    q: request.nextUrl.searchParams.get("q") ?? "",
  });
  if (!parsed.success) return validationError(parsed.error);

  // Normalize so equivalent queries share one cache entry.
  const query = parsed.data.q.toLowerCase().replace(/\s+/g, " ");

  try {
    const results = await searchBooksCached(query);
    return Response.json({ results } satisfies BookSearchResponse, {
      headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
    });
  } catch (error) {
    if (error instanceof ExternalApiError) {
      console.error(error);
      return apiError("upstream_error", "Book search is unavailable right now. Try again shortly.");
    }
    throw error;
  }
}
