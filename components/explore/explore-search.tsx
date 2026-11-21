"use client";

import { useQuery } from "@tanstack/react-query";
import { useId, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { apiFetch } from "@/lib/api-client";
import type { PlaceSearchResult } from "@/lib/books/public-types";
import { countryName } from "@/lib/geo/continents";
import { knownCountryShapes } from "@/lib/geo/map";

const MIN_QUERY_LENGTH = 2;

export type SearchPick =
  { kind: "country"; code: string; name: string } | { kind: "place"; place: PlaceSearchResult };

/** Jump to a place: countries (matched locally) and places with books (our API). */
export function ExploreSearch({ onPick }: { onPick: (pick: SearchPick) => void }) {
  const inputId = useId();
  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query.trim(), 300);
  const enabled = debounced.length >= MIN_QUERY_LENGTH;

  const countries = useMemo(
    () => knownCountryShapes().map((code) => ({ code, name: countryName(code) })),
    [],
  );
  const countryMatches = enabled
    ? countries
        .filter((c) => c.name.toLowerCase().includes(debounced.toLowerCase()))
        .sort((a, b) => {
          const q = debounced.toLowerCase();
          return (
            Number(b.name.toLowerCase().startsWith(q)) -
              Number(a.name.toLowerCase().startsWith(q)) || a.name.localeCompare(b.name)
          );
        })
        .slice(0, 3)
    : [];

  const places = useQuery({
    queryKey: ["place-search", debounced.toLowerCase()],
    queryFn: ({ signal }) =>
      apiFetch<{ results: PlaceSearchResult[] }>(
        `/api/explore/search?q=${encodeURIComponent(debounced)}`,
        { signal },
      ),
    enabled,
    staleTime: 5 * 60_000,
  });
  const placeMatches = (places.data?.results ?? []).filter((p) => p.precision !== "country");

  function pick(choice: SearchPick) {
    setQuery("");
    onPick(choice);
  }

  const itemClass =
    "flex w-full items-baseline justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50";

  return (
    <div className="space-y-2">
      <Label htmlFor={inputId}>Jump to a place</Label>
      <Input
        id={inputId}
        type="search"
        autoComplete="off"
        placeholder="e.g. Dublin or Japan"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {enabled ? (
        <div aria-live="polite">
          {countryMatches.length === 0 && placeMatches.length === 0 ? (
            <p className="px-2 text-sm text-muted-foreground">
              {places.isPending ? "Searching…" : `No places found for “${debounced}”.`}
            </p>
          ) : (
            <ul aria-label="Place search results" className="rounded-md border p-1">
              {countryMatches.map((country) => (
                <li key={country.code}>
                  <button
                    type="button"
                    className={itemClass}
                    onClick={() => pick({ kind: "country", ...country })}
                  >
                    <span>{country.name}</span>
                    <span className="text-xs text-muted-foreground">Country</span>
                  </button>
                </li>
              ))}
              {placeMatches.map((place) => (
                <li key={place.placeId}>
                  <button
                    type="button"
                    className={itemClass}
                    onClick={() => pick({ kind: "place", place })}
                  >
                    <span>
                      {place.name}
                      {place.countryCode ? (
                        <span className="text-muted-foreground">
                          , {countryName(place.countryCode)}
                        </span>
                      ) : null}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {place.bookCount} {place.bookCount === 1 ? "book" : "books"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
