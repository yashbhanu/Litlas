import { z } from "zod";
import { olWorkIdSchema } from "./books";

export const SHELF_STATUSES = ["read", "reading", "want"] as const;
export const shelfStatusSchema = z.enum(SHELF_STATUSES);
export type ShelfStatus = z.infer<typeof shelfStatusSchema>;

export const SHELF_STATUS_LABELS: Record<ShelfStatus, string> = {
  read: "Read",
  reading: "Reading",
  want: "Want to read",
};

/**
 * Body of POST /api/shelf. Identify the book by Open Library work id (search results) or
 * by our book id (explore, book and place pages; seeded books may have no OL id).
 */
export const upsertShelfEntrySchema = z
  .object({
    olWorkId: olWorkIdSchema.optional(),
    bookId: z.uuid().optional(),
    status: shelfStatusSchema,
    rating: z.number().int().min(1).max(5).nullish(),
    finishedOn: z.iso.date().nullish(),
  })
  .refine((input) => (input.olWorkId === undefined) !== (input.bookId === undefined), {
    message: "Send exactly one of olWorkId or bookId",
    path: ["olWorkId"],
  })
  .transform((input) => ({
    book: input.bookId
      ? ({ kind: "id", bookId: input.bookId } as const)
      : ({ kind: "openLibrary", olWorkId: input.olWorkId! } as const),
    status: input.status,
    // A rating or finish date only makes sense once you've started or finished the book.
    rating: input.status === "want" ? null : (input.rating ?? null),
    finishedOn: input.status === "read" ? (input.finishedOn ?? null) : null,
  }));
export type UpsertShelfEntryInput = z.input<typeof upsertShelfEntrySchema>;

export const shelfEntryIdSchema = z.uuid();
