import "server-only";

import type { OpenLibraryClient } from "@/lib/external/openlibrary";
import { createSupabaseAdminClient } from "./admin";

export const BOOK_COLUMNS =
  "id, ol_work_id, wikidata_id, title, authors, first_publish_year, cover_id, setting_checked_at, metadata_checked_at" as const;

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

async function findByOlWorkId(admin: AdminClient, olWorkId: string) {
  const { data, error } = await admin
    .from("books")
    .select(BOOK_COLUMNS)
    .eq("ol_work_id", olWorkId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

type BookRow = NonNullable<Awaited<ReturnType<typeof findByOlWorkId>>>;

/**
 * Fill a seeded book's missing metadata (cover, description, year, authors) from Open
 * Library, once. Wikidata titles are kept. If Open Library is down, the book is returned
 * as is and enrichment is retried next time.
 */
async function enrichFromOpenLibrary(
  admin: AdminClient,
  book: BookRow,
  openLibrary: OpenLibraryClient,
): Promise<BookRow> {
  if (!book.ol_work_id) return book;
  let meta;
  try {
    meta = await openLibrary.getWork(book.ol_work_id);
  } catch (error) {
    console.error(error);
    return book;
  }
  const { data: current } = await admin
    .from("books")
    .select("description")
    .eq("id", book.id)
    .single();
  const { data, error } = await admin
    .from("books")
    .update({
      cover_id: book.cover_id ?? meta?.coverId ?? null,
      description: current?.description ?? meta?.description ?? null,
      first_publish_year: book.first_publish_year ?? meta?.firstPublishYear ?? null,
      authors: book.authors.length ? book.authors : (meta?.authors ?? []),
      metadata_checked_at: new Date().toISOString(),
    })
    .eq("id", book.id)
    .select(BOOK_COLUMNS)
    .single();
  if (error) throw error;
  return data;
}

/**
 * Returns the `books` row for an Open Library work, creating it from Open Library
 * metadata the first time (each work is fetched at most once). Redirected work ids
 * resolve to the canonical id. Returns null if Open Library has no such work.
 * Writes use the service role: books are not client-writable.
 */
export async function findOrCreateBook(olWorkId: string, openLibrary: OpenLibraryClient) {
  const admin = createSupabaseAdminClient();

  const existing = await findByOlWorkId(admin, olWorkId);
  if (existing) {
    return existing.metadata_checked_at
      ? existing
      : enrichFromOpenLibrary(admin, existing, openLibrary);
  }

  const meta = await openLibrary.getWork(olWorkId);
  if (!meta) return null;

  if (meta.olWorkId !== olWorkId) {
    const canonical = await findByOlWorkId(admin, meta.olWorkId);
    if (canonical) return canonical;
  }

  const { data, error } = await admin
    .from("books")
    .upsert(
      {
        ol_work_id: meta.olWorkId,
        title: meta.title,
        authors: meta.authors,
        first_publish_year: meta.firstPublishYear,
        cover_id: meta.coverId,
        description: meta.description,
        metadata_checked_at: new Date().toISOString(),
      },
      { onConflict: "ol_work_id" },
    )
    .select(BOOK_COLUMNS)
    .single();
  if (error) throw error;
  return data;
}

/** A book row by our id (service role read; books are public anyway). */
export async function findBookById(bookId: string) {
  const { data, error } = await createSupabaseAdminClient()
    .from("books")
    .select(BOOK_COLUMNS)
    .eq("id", bookId)
    .maybeSingle();
  if (error) throw error;
  return data;
}
