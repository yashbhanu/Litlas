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

/** Body of POST /api/shelf. */
export const upsertShelfEntrySchema = z
  .object({
    olWorkId: olWorkIdSchema,
    status: shelfStatusSchema,
    rating: z.number().int().min(1).max(5).nullish(),
    finishedOn: z.iso.date().nullish(),
  })
  .transform((input) => ({
    olWorkId: input.olWorkId,
    status: input.status,
    // A rating or finish date only makes sense once you've started or finished the book.
    rating: input.status === "want" ? null : (input.rating ?? null),
    finishedOn: input.status === "read" ? (input.finishedOn ?? null) : null,
  }));
export type UpsertShelfEntryInput = z.input<typeof upsertShelfEntrySchema>;

export const shelfEntryIdSchema = z.uuid();
