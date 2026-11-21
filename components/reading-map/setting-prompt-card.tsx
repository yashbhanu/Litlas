"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2Icon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import { ApiErrorMessage } from "@/components/api-error-message";
import { Button } from "@/components/ui/button";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { apiFetch } from "@/lib/api-client";
import { countryName } from "@/lib/geo/continents";
import {
  APPROVAL_THRESHOLD,
  PLACE_SEARCH_DEBOUNCE_MS,
  PLACE_SEARCH_MIN_LENGTH,
} from "@/lib/locations/constants";
import type { PlaceCandidate, SuggestLocationResponse } from "@/lib/locations/types";
import type { SuggestLocationInput } from "@/lib/validation/locations";

/**
 * "Where is <book> set?" — a quick inline suggestion for one of the reader's books with no
 * setting (search a town or city, then Suggest). The book page has the full picker
 * (precision, fictional places).
 */
export function SettingPromptCard({ books }: { books: { bookId: string; title: string }[] }) {
  const router = useRouter();
  const inputId = useId();
  const listId = useId();
  const [index, setIndex] = useState(0);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<PlaceCandidate | null>(null);
  const [done, setDone] = useState<SuggestLocationResponse | null>(null);
  const book = books[index];

  const debounced = useDebouncedValue(query.trim(), PLACE_SEARCH_DEBOUNCE_MS);
  const enabled = !selected && debounced.length >= PLACE_SEARCH_MIN_LENGTH;
  const search = useQuery({
    queryKey: ["place-picker", debounced.toLowerCase()],
    queryFn: ({ signal }) =>
      apiFetch<{ results: PlaceCandidate[] }>(
        `/api/places/search?q=${encodeURIComponent(debounced)}`,
        {
          signal,
        },
      ),
    enabled,
    staleTime: 10 * 60_000,
  });

  const suggest = useMutation({
    mutationFn: (input: SuggestLocationInput) =>
      apiFetch<SuggestLocationResponse>(`/api/books/${book!.bookId}/locations`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: (result) => {
      setDone(result);
      if (result.status === "approved") router.refresh();
    },
  });

  if (!book) return null;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    suggest.mutate(
      selected.suggestedPrecision === "country" && selected.countryCode
        ? {
            precision: "country",
            name: countryName(selected.countryCode),
            countryCode: selected.countryCode,
          }
        : {
            precision: selected.suggestedPrecision === "region" ? "region" : "city",
            name: selected.name,
            osmId: selected.osmId,
            countryCode: selected.countryCode,
            lng: selected.lng,
            lat: selected.lat,
          },
    );
  }

  function next() {
    setDone(null);
    setSelected(null);
    setQuery("");
    suggest.reset();
    setIndex((i) => i + 1);
  }

  return (
    <section
      aria-labelledby={`${inputId}-heading`}
      className="rounded-2xl border border-warm-border bg-warm p-4 text-warm-foreground"
    >
      <h2 id={`${inputId}-heading`} className="font-heading text-lg leading-snug font-semibold">
        Where is “{book.title}” set?
      </h2>
      {done ? (
        <div role="status" className="mt-2 space-y-3">
          <p className="flex items-start gap-2 text-sm">
            <CheckCircle2Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
            {done.status === "approved"
              ? "Thanks! It's on the map now."
              : `Thanks! It appears on the map once ${Math.max(0, APPROVAL_THRESHOLD - (done.suggestion?.votes ?? 1))} more readers confirm it.`}
          </p>
          {index + 1 < books.length ? (
            <Button size="sm" variant="outline" className="bg-background" onClick={next}>
              Next book
            </Button>
          ) : null}
        </div>
      ) : (
        <>
          <p className="mt-1 text-sm opacity-90">
            We don&apos;t have a location for this book yet. Your answer helps other readers.
          </p>
          <form onSubmit={submit} className="relative mt-3 flex gap-2">
            <label htmlFor={inputId} className="sr-only">
              Book location
            </label>
            <input
              id={inputId}
              type="search"
              role="combobox"
              aria-expanded={enabled && !!search.data?.results.length}
              aria-controls={listId}
              autoComplete="off"
              placeholder="Search a town or city…"
              value={selected ? selected.name : query}
              onChange={(event) => {
                setSelected(null);
                setQuery(event.target.value);
              }}
              className="h-11 min-w-0 flex-1 rounded-xl border border-warm-border bg-background px-3.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/30"
            />
            <Button
              type="submit"
              disabled={!selected || suggest.isPending}
              className="h-11 rounded-xl bg-cluster px-5 text-white hover:bg-cluster/90"
            >
              {suggest.isPending ? "…" : "Suggest"}
            </Button>
            {enabled && search.data && search.data.results.length > 0 ? (
              <ul
                id={listId}
                aria-label="Place results"
                className="absolute top-full right-0 left-0 z-20 mt-1.5 max-h-60 overflow-y-auto rounded-xl border bg-popover p-1 text-foreground shadow-lg"
              >
                {search.data.results.map((candidate) => (
                  <li key={candidate.osmId}>
                    <button
                      type="button"
                      onClick={() => setSelected(candidate)}
                      className="w-full rounded-lg px-2.5 py-2 text-left text-sm outline-none hover:bg-muted focus-visible:bg-muted"
                    >
                      <span className="font-medium">{candidate.name}</span>
                      {candidate.description ? (
                        <span className="text-muted-foreground"> · {candidate.description}</span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </form>
          {suggest.error ? (
            <div className="mt-2">
              <ApiErrorMessage error={suggest.error} />
            </div>
          ) : null}
          <p className="mt-2 text-xs opacity-80">
            Fictional place, or set across a region?{" "}
            <Link
              href={`/book/${book.bookId}`}
              className="font-medium underline underline-offset-2"
            >
              More options
            </Link>
            {books.length > 1 ? (
              <>
                {" · "}
                <button
                  type="button"
                  onClick={next}
                  className="font-medium underline underline-offset-2"
                >
                  Skip
                </button>
              </>
            ) : null}
          </p>
        </>
      )}
    </section>
  );
}
