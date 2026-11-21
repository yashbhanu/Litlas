import type { NextRequest } from "next/server";
import { apiError, parseJsonBody, validationError } from "@/lib/api";
import { requireProfile } from "@/lib/api-auth";
import { createSupabaseAdminClient } from "@/lib/db/admin";
import { findBookById } from "@/lib/db/books";
import { listPendingSuggestions, suggestLocation } from "@/lib/db/locations";
import { consumeRateLimit } from "@/lib/db/rate-limit";
import { revalidateBookPlaces } from "@/lib/db/revalidate";
import { createSupabaseServerClient } from "@/lib/db/server";
import { RATE_LIMITS } from "@/lib/locations/constants";
import { locationErrorResponse } from "@/lib/locations/errors";
import type { SuggestLocationResponse } from "@/lib/locations/types";
import { uuidSchema } from "@/lib/validation/explore";
import { suggestLocationSchema } from "@/lib/validation/locations";

/**
 * POST /api/books/[id]/locations — suggest where a book is set. Creates a pending link
 * with the suggester's vote (or confirms an existing pending suggestion). 30 per day.
 */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/books/[id]/locations">) {
  const auth = await requireProfile("suggest a location");
  if (auth.response) return auth.response;

  const bookId = uuidSchema.safeParse((await ctx.params).id);
  if (!bookId.success) return validationError(bookId.error);
  const body = await parseJsonBody(request, suggestLocationSchema);
  if (body.response) return body.response;

  if (!(await findBookById(bookId.data))) return apiError("not_found", "Book not found.");

  const supabase = await createSupabaseServerClient();
  if (!(await consumeRateLimit(supabase, "suggest_location"))) {
    return apiError(
      "rate_limited",
      `You can suggest up to ${RATE_LIMITS.suggest_location} locations a day. Try again tomorrow.`,
    );
  }

  let result;
  try {
    result = await suggestLocation(createSupabaseAdminClient(), supabase, {
      bookId: bookId.data,
      userId: auth.profile.id,
      input: body.data,
    });
  } catch (error) {
    return locationErrorResponse(error);
  }
  if (result.status === "approved") revalidateBookPlaces(bookId.data);

  const pending = await listPendingSuggestions(supabase, bookId.data);
  return Response.json({
    status: result.status,
    suggestion: pending.find((s) => s.bookPlaceId === result.bookPlaceId) ?? null,
  } satisfies SuggestLocationResponse);
}
