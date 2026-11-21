"use client";

import { useQuery } from "@tanstack/react-query";
import { BookOpenIcon, GlobeIcon, MapPinIcon, SearchIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { apiFetch } from "@/lib/api-client";
import type { BookSummary, PlaceSearchResult } from "@/lib/books/public-types";
import { countryName } from "@/lib/geo/continents";
import { knownCountryShapes } from "@/lib/geo/map";
import { cn } from "@/lib/utils";

interface Option {
  key: string;
  href: string;
  label: string;
  detail: string;
  kind: "country" | "place" | "book";
}

const ICONS = { country: GlobeIcon, place: MapPinIcon, book: BookOpenIcon } as const;

/** Header search for places, countries and books (a keyboard-accessible combobox). */
export function GlobalSearch({ className }: { className?: string }) {
  const router = useRouter();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const debounced = useDebouncedValue(query.trim(), 250);
  const enabled = debounced.length >= 2;

  const countries = useMemo(
    () => knownCountryShapes().map((code) => ({ code, name: countryName(code) })),
    [],
  );
  const search = useQuery({
    queryKey: ["global-search", debounced.toLowerCase()],
    queryFn: ({ signal }) =>
      apiFetch<{ places: PlaceSearchResult[]; books: BookSummary[] }>(
        `/api/search?q=${encodeURIComponent(debounced)}`,
        { signal },
      ),
    enabled,
    staleTime: 5 * 60_000,
  });

  const options: Option[] = enabled
    ? [
        ...countries
          .filter((c) => c.name.toLowerCase().startsWith(debounced.toLowerCase()))
          .slice(0, 2)
          .map((c) => ({
            key: `c-${c.code}`,
            href: `/explore?country=${c.code}`,
            label: c.name,
            detail: "Country",
            kind: "country" as const,
          })),
        ...(search.data?.places ?? []).map((p) => ({
          key: `p-${p.placeId}`,
          href: `/explore?place=${p.placeId}`,
          label: p.name,
          detail: [
            p.countryCode ? countryName(p.countryCode) : null,
            `${p.bookCount} ${p.bookCount === 1 ? "book" : "books"}`,
          ]
            .filter(Boolean)
            .join(" · "),
          kind: "place" as const,
        })),
        ...(search.data?.books ?? []).map((b) => ({
          key: `b-${b.id}`,
          href: `/book/${b.id}`,
          label: b.title,
          detail: b.authors.join(", ") || "Book",
          kind: "book" as const,
        })),
      ]
    : [];
  const showList = open && enabled;

  function go(option: Option) {
    setOpen(false);
    setQuery("");
    inputRef.current?.blur();
    router.push(option.href);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, options.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter" && options[active]) {
      event.preventDefault();
      go(options[active]);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className={cn("relative", className)}>
      <SearchIcon
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <input
        ref={inputRef}
        type="search"
        role="combobox"
        aria-label="Search a place or a book"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && options[active] ? `${listId}-${active}` : undefined}
        autoComplete="off"
        placeholder="Search a place or a book…"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={onKeyDown}
        className="h-10 w-full rounded-xl border border-input bg-surface pr-3 pl-9 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:bg-background focus-visible:ring-3 focus-visible:ring-ring/30"
      />
      {showList ? (
        <div className="absolute top-full right-0 left-0 z-50 mt-2 overflow-hidden rounded-xl border bg-popover shadow-lg">
          {options.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">
              {search.isPending ? "Searching…" : `No places or books match “${debounced}”.`}
            </p>
          ) : (
            <ul
              id={listId}
              role="listbox"
              aria-label="Search results"
              className="max-h-96 overflow-y-auto p-1.5"
            >
              {options.map((option, index) => {
                const Icon = ICONS[option.kind];
                return (
                  <li
                    key={option.key}
                    id={`${listId}-${index}`}
                    role="option"
                    aria-selected={index === active}
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => setActive(index)}
                    onClick={() => go(option)}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-sm",
                      index === active && "bg-accent text-accent-foreground",
                    )}
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <Icon aria-hidden className="size-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{option.label}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {option.detail}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
