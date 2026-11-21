"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { MapPinIcon, SparklesIcon } from "lucide-react";
import { useId, useState, type FormEvent } from "react";
import { ApiErrorMessage } from "@/components/api-error-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { apiFetch } from "@/lib/api-client";
import { countryName } from "@/lib/geo/continents";
import { PLACE_SEARCH_DEBOUNCE_MS, PLACE_SEARCH_MIN_LENGTH } from "@/lib/locations/constants";
import type { PlaceCandidate, SuggestLocationResponse } from "@/lib/locations/types";
import type { SuggestLocationInput } from "@/lib/validation/locations";
import { cn } from "@/lib/utils";

type Precision = "city" | "region" | "country";

const PRECISIONS: { value: Precision; label: string; hint: string }[] = [
  { value: "city", label: "City or place", hint: "A pin on the map" },
  { value: "region", label: "Region", hint: "Shades its country" },
  { value: "country", label: "Whole country", hint: "Shades the country" },
];

/**
 * Suggest where a book is set: search real places (Photon, through our API; 300 ms
 * debounce, 3+ characters) and pick a precision, or name a fictional place.
 */
export function PlacePicker({
  bookId,
  onSuggested,
  onSkip,
  skipLabel = "Skip for now",
}: {
  bookId: string;
  onSuggested: (result: SuggestLocationResponse) => void;
  onSkip?: () => void;
  skipLabel?: string;
}) {
  const searchId = useId();
  const fictionalId = useId();
  const [mode, setMode] = useState<"real" | "fictional">("real");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<PlaceCandidate | null>(null);
  const [precision, setPrecision] = useState<Precision>("city");
  const [fictionalName, setFictionalName] = useState("");

  const debounced = useDebouncedValue(query.trim(), PLACE_SEARCH_DEBOUNCE_MS);
  const searchEnabled = mode === "real" && !selected && debounced.length >= PLACE_SEARCH_MIN_LENGTH;
  const search = useQuery({
    queryKey: ["place-picker", debounced.toLowerCase()],
    queryFn: ({ signal }) =>
      apiFetch<{ results: PlaceCandidate[] }>(
        `/api/places/search?q=${encodeURIComponent(debounced)}`,
        {
          signal,
        },
      ),
    enabled: searchEnabled,
    staleTime: 10 * 60_000,
  });

  const suggest = useMutation({
    mutationFn: (input: SuggestLocationInput) =>
      apiFetch<SuggestLocationResponse>(`/api/books/${bookId}/locations`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: onSuggested,
  });

  function pick(candidate: PlaceCandidate) {
    setSelected(candidate);
    setPrecision(candidate.suggestedPrecision);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (mode === "fictional") {
      if (fictionalName.trim())
        suggest.mutate({ precision: "fictional", name: fictionalName.trim() });
      return;
    }
    if (!selected) return;
    if (precision === "country") {
      if (selected.countryCode) {
        suggest.mutate({
          precision: "country",
          name: countryName(selected.countryCode),
          countryCode: selected.countryCode,
        });
      }
      return;
    }
    suggest.mutate({
      precision,
      name: selected.name,
      osmId: selected.osmId,
      countryCode: selected.countryCode,
      lng: selected.lng,
      lat: selected.lat,
    });
  }

  const canSubmit =
    !suggest.isPending &&
    (mode === "fictional"
      ? fictionalName.trim().length > 0
      : selected !== null && (precision !== "country" || selected.countryCode !== null));

  return (
    <form onSubmit={submit} className="space-y-4" aria-label="Suggest a location">
      <div role="radiogroup" aria-label="Kind of place" className="flex gap-2">
        {(
          [
            ["real", "Real place", MapPinIcon],
            ["fictional", "Fictional place", SparklesIcon],
          ] as const
        ).map(([value, label, Icon]) => (
          <label
            key={value}
            className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm has-checked:border-primary has-checked:bg-muted has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
          >
            <input
              type="radio"
              name="place-kind"
              value={value}
              checked={mode === value}
              onChange={() => setMode(value)}
              className="sr-only"
            />
            <Icon aria-hidden className="size-4" />
            {label}
          </label>
        ))}
      </div>

      {mode === "fictional" ? (
        <div className="space-y-1.5">
          <Label htmlFor={fictionalId}>Name of the fictional place</Label>
          <Input
            id={fictionalId}
            value={fictionalName}
            maxLength={120}
            placeholder="e.g. Macondo"
            onChange={(event) => setFictionalName(event.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Fictional places are listed on the book page, not on the map.
          </p>
        </div>
      ) : selected ? (
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-2 rounded-md border p-3 text-sm">
            <div>
              <p className="font-medium">{selected.name}</p>
              {selected.description ? (
                <p className="text-muted-foreground">{selected.description}</p>
              ) : null}
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={() => setSelected(null)}>
              Change
            </Button>
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">How precise is this setting?</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {PRECISIONS.map(({ value, label, hint }) => {
                const disabled = value === "country" && !selected.countryCode;
                return (
                  <label
                    key={value}
                    className={cn(
                      "flex cursor-pointer flex-col rounded-md border px-3 py-2 text-sm has-checked:border-primary has-checked:bg-muted has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                      disabled && "cursor-not-allowed opacity-50",
                    )}
                  >
                    <input
                      type="radio"
                      name="precision"
                      value={value}
                      checked={precision === value}
                      disabled={disabled}
                      onChange={() => setPrecision(value)}
                      className="sr-only"
                    />
                    <span className="font-medium">
                      {value === "country" && selected.countryCode
                        ? countryName(selected.countryCode)
                        : label}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {value === "country" ? "Whole country · shaded" : hint}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        </div>
      ) : (
        <div className="space-y-2">
          <Label htmlFor={searchId}>Search for a place</Label>
          <Input
            id={searchId}
            type="search"
            autoComplete="off"
            placeholder="e.g. Bogotá, Yorkshire, Japan"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <div aria-live="polite" className="min-h-5">
            {!searchEnabled ? (
              query.trim().length > 0 && query.trim().length < PLACE_SEARCH_MIN_LENGTH ? (
                <p className="text-xs text-muted-foreground">
                  Type at least {PLACE_SEARCH_MIN_LENGTH} characters.
                </p>
              ) : null
            ) : search.isPending ? (
              <p className="text-sm text-muted-foreground">Searching…</p>
            ) : search.isError ? (
              <ApiErrorMessage error={search.error} />
            ) : search.data.results.length === 0 ? (
              <p className="text-sm text-muted-foreground">No places found for “{debounced}”.</p>
            ) : (
              <ul
                aria-label="Place results"
                className="max-h-60 overflow-y-auto rounded-md border p-1"
              >
                {search.data.results.map((candidate) => (
                  <li key={candidate.osmId}>
                    <button
                      type="button"
                      onClick={() => pick(candidate)}
                      className="w-full rounded-md px-2 py-1.5 text-left text-sm outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      <span className="font-medium">{candidate.name}</span>
                      {candidate.description ? (
                        <span className="text-muted-foreground"> · {candidate.description}</span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Place search by Photon, © OpenStreetMap contributors.
          </p>
        </div>
      )}

      {suggest.error ? <ApiErrorMessage error={suggest.error} /> : null}

      <div className="flex justify-between gap-2">
        {onSkip ? (
          <Button type="button" variant="ghost" onClick={onSkip}>
            {skipLabel}
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit" disabled={!canSubmit}>
          {suggest.isPending ? "Suggesting…" : "Suggest this location"}
        </Button>
      </div>
    </form>
  );
}
