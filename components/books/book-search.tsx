"use client";

import { useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { apiFetch } from "@/lib/api-client";
import type { BookSearchResponse, BookSearchResult } from "@/lib/validation/books";
import { BookCover } from "./book-cover";

const MIN_QUERY_LENGTH = 2;

export function BookSearch({ onSelect }: { onSelect: (book: BookSearchResult) => void }) {
  const inputId = useId();
  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query.trim(), 300);
  const enabled = debounced.length >= MIN_QUERY_LENGTH;

  const search = useQuery({
    queryKey: ["book-search", debounced.toLowerCase()],
    queryFn: ({ signal }) =>
      apiFetch<BookSearchResponse>(`/api/books/search?q=${encodeURIComponent(debounced)}`, {
        signal,
      }),
    enabled,
    staleTime: 5 * 60_000,
  });

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor={inputId}>Search by title or author</Label>
        <Input
          id={inputId}
          type="search"
          autoFocus
          autoComplete="off"
          placeholder="e.g. Ulysses"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      <div aria-live="polite" className="min-h-6">
        {!enabled ? null : search.isPending ? (
          <ul className="space-y-2" aria-label="Loading results">
            {[0, 1, 2].map((i) => (
              <li key={i} className="flex gap-3">
                <Skeleton className="h-[60px] w-10" />
                <div className="flex-1 space-y-2 py-1">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </li>
            ))}
          </ul>
        ) : search.isError ? (
          <p role="alert" className="text-sm text-destructive">
            {search.error.message}
          </p>
        ) : search.data.results.length === 0 ? (
          <p className="text-sm text-muted-foreground">No books found for “{debounced}”.</p>
        ) : (
          <ul className="max-h-[50vh] space-y-1 overflow-y-auto" aria-label="Search results">
            {search.data.results.map((book) => (
              <li key={book.olWorkId}>
                <button
                  type="button"
                  onClick={() => onSelect(book)}
                  className="flex w-full items-center gap-3 rounded-md p-1.5 text-left outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <BookCover coverId={book.coverId} title={book.title} size="sm" />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{book.title}</span>
                    <span className="block truncate text-sm text-muted-foreground">
                      {[book.authors.join(", "), book.firstPublishYear]
                        .filter(Boolean)
                        .join(" · ") || "Unknown author"}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
