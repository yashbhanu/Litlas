"use client";

import { useState } from "react";
import type { BookSearchResult } from "@/lib/validation/books";
import { AddBookForm } from "./add-book-form";
import { BookSearch } from "./book-search";

/** Search Open Library, pick a book, set status/rating/date, add it to the shelf. */
export function AddBookFlow({ onAdded }: { onAdded: () => void }) {
  const [selected, setSelected] = useState<BookSearchResult | null>(null);

  return selected ? (
    <AddBookForm book={selected} onBack={() => setSelected(null)} onAdded={onAdded} />
  ) : (
    <BookSearch onSelect={setSelected} />
  );
}
