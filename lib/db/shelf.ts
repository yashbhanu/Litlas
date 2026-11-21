import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ShelfEntry } from "@/lib/books/types";
import type { ShelfStatus } from "@/lib/validation/shelf";
import type { Database } from "./database.types";

type Client = SupabaseClient<Database>;

const SHELF_ENTRY_COLUMNS =
  "id, status, rating, finished_on, created_at, book:books!inner(id, ol_work_id, title, authors, first_publish_year, cover_id)" as const;

type ShelfRow = {
  id: string;
  status: ShelfStatus;
  rating: number | null;
  finished_on: string | null;
  created_at: string | null;
  book: {
    id: string;
    ol_work_id: string | null;
    title: string;
    authors: string[];
    first_publish_year: number | null;
    cover_id: number | null;
  };
};

function toShelfEntry(row: ShelfRow): ShelfEntry {
  return {
    id: row.id,
    status: row.status,
    rating: row.rating,
    finishedOn: row.finished_on,
    createdAt: row.created_at,
    book: {
      id: row.book.id,
      olWorkId: row.book.ol_work_id,
      title: row.book.title,
      authors: row.book.authors,
      firstPublishYear: row.book.first_publish_year,
      coverId: row.book.cover_id,
    },
  };
}

/** A user's shelf, newest first. RLS decides visibility (owner, or public profile). */
export async function listShelf(supabase: Client, userId: string): Promise<ShelfEntry[]> {
  const { data, error } = await supabase
    .from("shelf_entries")
    .select(SHELF_ENTRY_COLUMNS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data satisfies ShelfRow[]).map(toShelfEntry);
}

/** Add a book to the user's shelf, or update the existing entry for that book. */
export async function upsertShelfEntry(
  supabase: Client,
  input: {
    userId: string;
    bookId: string;
    status: ShelfStatus;
    rating: number | null;
    finishedOn: string | null;
  },
): Promise<ShelfEntry> {
  const { data, error } = await supabase
    .from("shelf_entries")
    .upsert(
      {
        user_id: input.userId,
        book_id: input.bookId,
        status: input.status,
        rating: input.rating,
        finished_on: input.finishedOn,
      },
      { onConflict: "user_id,book_id" },
    )
    .select(SHELF_ENTRY_COLUMNS)
    .single();
  if (error) throw error;
  return toShelfEntry(data satisfies ShelfRow);
}

/** Delete one of the user's shelf entries. Returns false if it didn't exist or isn't theirs. */
export async function deleteShelfEntry(supabase: Client, entryId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("shelf_entries")
    .delete()
    .eq("id", entryId)
    .select("id");
  if (error) throw error;
  return data.length > 0;
}
