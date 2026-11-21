"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { XIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { BookList } from "@/components/books/book-list";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api-client";
import type { BookListPage } from "@/lib/books/public-types";
import { countryName } from "@/lib/geo/continents";
import type { ExploreSelection } from "./types";

/** Books set at the selected place or in the selected country, 20 per page. */
export function SelectionBooks({
  selection,
  onClear,
}: {
  selection: ExploreSelection;
  onClear: () => void;
}) {
  const [page, setPage] = useState(1);
  const url =
    selection.kind === "place"
      ? `/api/places/${selection.placeId}/books?page=${page}`
      : `/api/countries/${selection.code}/books?page=${page}`;

  const query = useQuery({
    queryKey: ["selection-books", url],
    queryFn: ({ signal }) => apiFetch<BookListPage>(url, { signal }),
    placeholderData: keepPreviousData,
  });

  const subtitle =
    selection.kind === "place"
      ? selection.countryCode
        ? countryName(selection.countryCode)
        : null
      : "Country";

  return (
    <section aria-labelledby="selection-heading" className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
          <h2 id="selection-heading" className="text-lg font-semibold">
            Books set in {selection.name}
          </h2>
          {query.data ? (
            <p className="text-sm text-muted-foreground">
              {query.data.total} {query.data.total === 1 ? "book" : "books"}
              {selection.kind === "place" ? (
                <>
                  {" · "}
                  <Link
                    href={`/place/${selection.placeId}`}
                    className="underline-offset-4 hover:underline"
                  >
                    Place page
                  </Link>
                </>
              ) : null}
            </p>
          ) : null}
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onClear} aria-label="Close book list">
          <XIcon aria-hidden />
        </Button>
      </div>

      {query.isPending ? (
        <Skeleton className="h-48 w-full" />
      ) : query.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {query.error.message}
        </p>
      ) : query.data.books.length === 0 ? (
        <p className="text-sm text-muted-foreground">No books set here yet.</p>
      ) : (
        <div
          aria-busy={query.isFetching || undefined}
          className={query.isPlaceholderData ? "opacity-60" : undefined}
        >
          <BookList books={query.data.books} label={`Books set in ${selection.name}`} />
        </div>
      )}

      {query.data && query.data.pageCount > 1 ? (
        <nav aria-label="Pagination" className="flex items-center justify-between gap-2 text-sm">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </Button>
          <span className="text-muted-foreground">
            Page {query.data.page} of {query.data.pageCount}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= query.data.pageCount}
            onClick={() => setPage(page + 1)}
          >
            Next
          </Button>
        </nav>
      ) : null}
    </section>
  );
}
