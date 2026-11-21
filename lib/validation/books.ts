import { z } from "zod";

/** Open Library work id, e.g. "OL86318W". */
export const olWorkIdSchema = z.string().regex(/^OL\d+W$/, "Invalid Open Library work id");

export const bookSearchQuerySchema = z.object({
  q: z.string().trim().min(2, "Search needs at least 2 characters").max(100),
});

/** A normalized book search result, as returned by GET /api/books/search. */
export const bookSearchResultSchema = z.object({
  olWorkId: olWorkIdSchema,
  title: z.string(),
  authors: z.array(z.string()),
  firstPublishYear: z.number().int().nullable(),
  coverId: z.number().int().nullable(),
});
export type BookSearchResult = z.infer<typeof bookSearchResultSchema>;

export const bookSearchResponseSchema = z.object({
  results: z.array(bookSearchResultSchema),
});
export type BookSearchResponse = z.infer<typeof bookSearchResponseSchema>;
