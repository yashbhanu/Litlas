import { revalidateTag } from "next/cache";
import { apiError, isPostgrestError, parseJsonBody, PG } from "@/lib/api";
import { getProfile, getSessionUser } from "@/lib/auth";
import type { UpsertShelfResponse } from "@/lib/books/types";
import { createSupabaseAdminClient } from "@/lib/db/admin";
import { findBookById, findOrCreateBook } from "@/lib/db/books";
import { listBookPlaces } from "@/lib/db/places";
import { BOOK_PLACES_TAG, bookTag } from "@/lib/db/public";
import { createSupabaseServerClient } from "@/lib/db/server";
import { ensureBookSettings } from "@/lib/db/settings";
import { consumeRateLimit } from "@/lib/db/rate-limit";
import { upsertShelfEntry } from "@/lib/db/shelf";
import { ExternalApiError } from "@/lib/external/http";
import { getOpenLibrary } from "@/lib/external/openlibrary.server";
import { getWikidata } from "@/lib/external/wikidata.server";
import { RATE_LIMITS } from "@/lib/locations/constants";
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

  if (!(await consumeRateLimit(await createSupabaseServerClient(), "shelf_write"))) {
    return apiError(
      "rate_limited",
      `You can update your shelf up to ${RATE_LIMITS.shelf_write} times a day. Try again tomorrow.`,
    );
  }

  let book;
  try {
    book =
      input.book.kind === "id"
        ? await findBookById(input.book.bookId)
        : await findOrCreateBook(input.book.olWorkId, getOpenLibrary());
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
  if (!book) {
    return apiError(
      "not_found",
      input.book.kind === "id" ? "Book not found." : "That book wasn't found on Open Library.",
    );
  }

  // Seeded books may have just been enriched with Open Library metadata.
  revalidateTag(bookTag(book.id), "max");

  const supabase = await createSupabaseServerClient();
  let entry;
  try {
    entry = await upsertShelfEntry(supabase, {
      userId: user.id,
      bookId: book.id,
      status: input.status,
      rating: input.rating,
      finishedOn: input.finishedOn,
    });
  } catch (error) {
    if (isPostgrestError(error) && error.code === PG.foreignKeyViolation) {
      return apiError("profile_required", "Pick a username before adding books.");
    }
    throw error;
  }

  // Look up the book's setting on Wikidata if it's new or the last check is 90+ days old.
  // A Wikidata outage doesn't block adding the book; the lookup is retried next time.
  let settingLookupFailed = false;
  try {
    if (await ensureBookSettings(createSupabaseAdminClient(), book, getWikidata())) {
      // New links show up on Explore, place pages and the book page.
      revalidateTag(BOOK_PLACES_TAG, "max");
      revalidateTag(bookTag(book.id), "max");
    }
  } catch (error) {
    if (!(error instanceof ExternalApiError)) throw error;
    console.error(error);
    settingLookupFailed = true;
  }

  const places = await listBookPlaces(supabase, [book.id]);
  return Response.json({
    entry: { ...entry, places },
    settingLookupFailed,
  } satisfies UpsertShelfResponse);
}
