import "server-only";

import { revalidateTag } from "next/cache";
import { BOOK_PLACES_TAG, bookTag } from "./public";

/**
 * A book's approved places changed (approval, rejection, merge): refresh its page and
 * everything built from book ↔ place links (Explore, place and country lists). Expire
 * immediately so the next visitor sees the change, not a stale copy.
 */
export function revalidateBookPlaces(bookId: string) {
  revalidateTag(bookTag(bookId), { expire: 0 });
  revalidateTag(BOOK_PLACES_TAG, { expire: 0 });
}
