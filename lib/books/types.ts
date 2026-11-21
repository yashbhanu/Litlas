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
