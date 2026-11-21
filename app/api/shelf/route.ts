import { apiError, isPostgrestError, parseJsonBody, PG } from "@/lib/api";
import { getProfile, getSessionUser } from "@/lib/auth";
import { findOrCreateBook } from "@/lib/db/books";
import { createSupabaseServerClient } from "@/lib/db/server";
import { upsertShelfEntry } from "@/lib/db/shelf";
import { ExternalApiError } from "@/lib/external/http";
import { getOpenLibrary } from "@/lib/external/openlibrary.server";
import { upsertShelfEntrySchema } from "@/lib/validation/shelf";

/** POST /api/shelf — add a book to the signed-in user's shelf, or update its entry. */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return apiError("unauthorized", "Sign in to add books to your shelf.");

  const body = await parseJsonBody(request, upsertShelfEntrySchema);
  if (body.response) return body.response;
  const input = body.data;

  const profile = await getProfile(user.id);
  if (!profile) return apiError("profile_required", "Pick a username before adding books.");

  let book;
  try {
    book = await findOrCreateBook(input.olWorkId, getOpenLibrary());
  } catch (error) {
    if (error instanceof ExternalApiError) {
      console.error(error);
      return apiError(
        "upstream_error",
        "Open Library is unavailable right now. Try again shortly.",
      );
    }
    throw error;
  }
  if (!book) return apiError("not_found", "That book wasn't found on Open Library.");

  // Phase 2: look up the book's setting on Wikidata here when setting_checked_at is stale.

  const supabase = await createSupabaseServerClient();
  try {
    const entry = await upsertShelfEntry(supabase, {
      userId: user.id,
      bookId: book.id,
      status: input.status,
      rating: input.rating,
      finishedOn: input.finishedOn,
    });
    return Response.json({ entry });
  } catch (error) {
    if (isPostgrestError(error) && error.code === PG.foreignKeyViolation) {
      return apiError("profile_required", "Pick a username before adding books.");
    }
    throw error;
  }
}
