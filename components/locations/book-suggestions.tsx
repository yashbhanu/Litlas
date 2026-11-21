"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckIcon, MapPinPlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApiErrorMessage } from "@/components/api-error-message";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { apiFetch } from "@/lib/api-client";
import { countryName } from "@/lib/geo/continents";
import { APPROVAL_THRESHOLD } from "@/lib/locations/constants";
import type {
  PendingSuggestion,
  SuggestLocationResponse,
  VoteResponse,
} from "@/lib/locations/types";
import { PlacePicker } from "./place-picker";
import { SuggestionThanks } from "./suggestion-thanks";

const PRECISION_LABELS: Record<PendingSuggestion["precision"], string> = {
  point: "Place",
  city: "City",
  region: "Region",
  country: "Country",
  fictional: "Fictional place",
};

/**
 * Pending suggestions for a book, with "Confirm this location" for other readers, and
 * the "Suggest a location" dialog. Live per viewer (GET /api/books/[id]); the approved
 * settings above it are server-rendered and refreshed when a suggestion is approved.
 */
export function BookSuggestions({ bookId, bookTitle }: { bookId: string; bookTitle: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const queryKey = ["book-suggestions", bookId];
  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) =>
      apiFetch<{ suggestions: PendingSuggestion[] }>(`/api/books/${bookId}`, { signal }),
    staleTime: 0,
  });

  const onChanged = (approved: boolean) => {
    void queryClient.invalidateQueries({ queryKey });
    if (approved) router.refresh();
  };

  const suggestions = query.data?.suggestions ?? [];

  return (
    <section aria-labelledby="suggestions-heading" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="suggestions-heading" className="text-base font-semibold">
          Suggested by readers
        </h3>
        <SuggestDialog
          bookId={bookId}
          bookTitle={bookTitle}
          onSuggested={(r) => onChanged(r.status === "approved")}
        />
      </div>
      {query.isError ? <ApiErrorMessage error={query.error} /> : null}
      {suggestions.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {query.isPending
            ? "Loading suggestions…"
            : "No pending suggestions. Know where it's set? Suggest a location."}
        </p>
      ) : (
        <ul className="divide-y rounded-lg border" aria-label="Pending suggestions">
          {suggestions.map((suggestion) => (
            <SuggestionRow
              key={suggestion.bookPlaceId}
              suggestion={suggestion}
              onChanged={onChanged}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function SuggestionRow({
  suggestion,
  onChanged,
}: {
  suggestion: PendingSuggestion;
  onChanged: (approved: boolean) => void;
}) {
  const vote = useMutation({
    mutationFn: () =>
      apiFetch<VoteResponse>(`/api/locations/${suggestion.bookPlaceId}/vote`, { method: "POST" }),
    onSuccess: (result) => onChanged(result.status === "approved"),
  });
  const unvote = useMutation({
    mutationFn: () =>
      apiFetch<void>(`/api/locations/${suggestion.bookPlaceId}/vote`, { method: "DELETE" }),
    onSuccess: () => onChanged(false),
  });
  const where =
    suggestion.countryCode && suggestion.precision !== "country"
      ? countryName(suggestion.countryCode)
      : null;
  const error = vote.error ?? unvote.error;

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
      <div>
        <p>
          <span className="font-medium">{suggestion.name}</span>
          {where ? <span className="text-muted-foreground"> · {where}</span> : null}
        </p>
        <p className="text-xs text-muted-foreground">
          {PRECISION_LABELS[suggestion.precision]} · {suggestion.votes} of {APPROVAL_THRESHOLD}{" "}
          confirmations
        </p>
        {error ? <ApiErrorMessage error={error} /> : null}
      </div>
      {suggestion.mine ? (
        <Badge variant="secondary">Your suggestion</Badge>
      ) : suggestion.voted ? (
        <div className="flex items-center gap-2">
          <Badge variant="secondary">
            <CheckIcon aria-hidden />
            You confirmed
          </Badge>
          <Button
            size="sm"
            variant="ghost"
            disabled={unvote.isPending}
            onClick={() => unvote.mutate()}
          >
            Undo
          </Button>
        </div>
      ) : (
        <Button
          size="sm"
          variant="outline"
          disabled={vote.isPending}
          onClick={() => vote.mutate()}
          aria-label={`Confirm ${suggestion.name}`}
        >
          Confirm this location
        </Button>
      )}
    </li>
  );
}

function SuggestDialog({
  bookId,
  bookTitle,
  onSuggested,
}: {
  bookId: string;
  bookTitle: string;
  onSuggested: (result: SuggestLocationResponse) => void;
}) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<SuggestLocationResponse | null>(null);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setResult(null);
      }}
    >
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <MapPinPlusIcon aria-hidden />
        Suggest a location
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Where is {bookTitle} set?</DialogTitle>
          <DialogDescription>
            Suggestions appear on the map once {APPROVAL_THRESHOLD - 1} other readers confirm them.
          </DialogDescription>
        </DialogHeader>
        {result ? (
          <SuggestionThanks result={result} onDone={() => setOpen(false)} />
        ) : open ? (
          <PlacePicker
            bookId={bookId}
            onSuggested={(r) => {
              setResult(r);
              onSuggested(r);
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
