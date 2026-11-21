"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ArrowRightIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { BookList } from "@/components/books/book-list";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api-client";
import type { BookListPage, CountryBookPage } from "@/lib/books/public-types";
import { continentOf, countryName } from "@/lib/geo/continents";
import { cn } from "@/lib/utils";
import type { ExploreSelection } from "./types";

/** A filter chip within a country: all books, or one of its top places. */
type Filter = { kind: "all" } | { kind: "place"; placeId: string; name: string };

/** Books set at the selected place or in the selected country, 20 per page. */
export function SelectionBooks({
  selection,
  onClear,
}: {
  selection: ExploreSelection;
  onClear: () => void;
}) {
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<Filter>({ kind: "all" });

  const placeId =
    selection.kind === "place"
      ? selection.placeId
      : filter.kind === "place"
        ? filter.placeId
        : null;
  const url = placeId
    ? `/api/places/${placeId}/books?page=${page}`
    : `/api/countries/${selection.kind === "country" ? selection.code : ""}/books?page=${page}`;

  const query = useQuery({
    queryKey: ["selection-books", url],
    queryFn: ({ signal }) => apiFetch<BookListPage | CountryBookPage>(url, { signal }),
    placeholderData: keepPreviousData,
  });
  // Country summary (chips, counts) comes from the unfiltered country query.
  const country = useQuery({
    queryKey: [
      "selection-books",
      `/api/countries/${selection.kind === "country" ? selection.code : ""}/books?page=1`,
    ],
    queryFn: ({ signal }) =>
      apiFetch<CountryBookPage>(
        `/api/countries/${selection.kind === "country" ? selection.code : ""}/books?page=1`,
        { signal },
      ),
    enabled: selection.kind === "country",
  });

  const code = selection.kind === "country" ? selection.code : selection.countryCode;
  const kicker =
    selection.kind === "country"
      ? (continentOf(selection.code) ?? "Country")
      : code
        ? countryName(code)
        : "Place";
  const summary =
    selection.kind === "country" && country.data
      ? `${country.data.total} ${country.data.total === 1 ? "book" : "books"} set here · ${country.data.placeCount} ${country.data.placeCount === 1 ? "place" : "places"} · added by readers and Wikidata`
      : query.data
        ? `${query.data.total} ${query.data.total === 1 ? "book" : "books"} set here · added by readers and Wikidata`
        : " ";
  const seeAll =
    selection.kind === "place"
      ? { href: `/place/${selection.placeId}`, label: `See all books set in ${selection.name}` }
      : filter.kind === "place"
        ? { href: `/place/${filter.placeId}`, label: `See all books set in ${filter.name}` }
        : { href: `/country/${selection.code}`, label: `See all books set in ${selection.name}` };

  function choose(next: Filter) {
    setFilter(next);
    setPage(1);
  }

  return (
    <section aria-labelledby="selection-heading" className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{kicker}</p>
          <h2 id="selection-heading" className="text-2xl font-semibold tracking-tight lg:text-3xl">
            <span className="sr-only">Books set in </span>
            {selection.name}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{summary}</p>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onClear} aria-label="Close book list">
          <XIcon aria-hidden />
        </Button>
      </div>

      {selection.kind === "country" && country.data && country.data.topPlaces.length > 0 ? (
        <div role="group" aria-label="Filter by place" className="flex flex-wrap gap-2">
          <Chip active={filter.kind === "all"} onClick={() => choose({ kind: "all" })}>
            All
          </Chip>
          {country.data.topPlaces.map((place) => (
            <Chip
              key={place.placeId}
              active={filter.kind === "place" && filter.placeId === place.placeId}
              onClick={() => choose({ kind: "place", placeId: place.placeId, name: place.name })}
            >
              {place.name}
            </Chip>
          ))}
        </div>
      ) : null}

      {query.isPending ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex gap-3 p-2">
              <Skeleton className="h-14 w-10" />
              <div className="flex-1 space-y-2 py-1">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : query.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {query.error.message}
        </p>
      ) : query.data.books.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          No books set here yet.
        </p>
      ) : (
        <div
          aria-busy={query.isFetching || undefined}
          className={cn("-mx-2 transition-opacity", query.isPlaceholderData && "opacity-60")}
        >
          <BookList
            books={query.data.books}
            label={`Books set in ${filter.kind === "place" ? filter.name : selection.name}`}
            setting={
              selection.kind === "place"
                ? selection.name
                : filter.kind === "place"
                  ? filter.name
                  : undefined
            }
          />
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

      <Link
        href={seeAll.href}
        className="inline-flex items-center gap-1 text-sm font-medium text-primary underline underline-offset-4 hover:no-underline"
      >
        {seeAll.label}
        <ArrowRightIcon aria-hidden className="size-4" />
      </Link>
    </section>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
        active
          ? "border-primary/40 bg-secondary text-secondary-foreground"
          : "bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
