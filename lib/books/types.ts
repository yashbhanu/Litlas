import type { BookPlace } from "@/lib/geo/map";
import type { ShelfStatus } from "@/lib/validation/shelf";

/** A shelf entry with its book, as sent to the client. */
export interface ShelfEntry {
  id: string;
  status: ShelfStatus;
  rating: number | null;
  finishedOn: string | null;
  createdAt: string | null;
  book: {
    id: string;
    olWorkId: string | null;
    title: string;
    authors: string[];
    firstPublishYear: number | null;
    coverId: number | null;
  };
}

/** A shelf entry plus the book's approved settings. */
export interface ShelfEntryWithPlaces extends ShelfEntry {
  places: BookPlace[];
}

/** Response of POST /api/shelf. */
export interface UpsertShelfResponse {
  entry: ShelfEntryWithPlaces;
  /** True when the Wikidata lookup failed; the book was still added. */
  settingLookupFailed: boolean;
}
