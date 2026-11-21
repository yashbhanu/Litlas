"use client";

import { useMutation } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiErrorMessage } from "@/components/api-error-message";
import { apiFetch } from "@/lib/api-client";
import type { UpsertShelfResponse } from "@/lib/books/types";
import {
  SHELF_STATUSES,
  SHELF_STATUS_LABELS,
  type ShelfStatus,
  type UpsertShelfEntryInput,
} from "@/lib/validation/shelf";
import { BookCover } from "./book-cover";

/** A book the form can add: a search result (by OL id) or a known book (by our id). */
export interface AddableBook {
  bookId?: string;
  olWorkId: string | null;
  title: string;
  authors: string[];
  firstPublishYear: number | null;
  coverId: number | null;
}

export function AddBookForm({
  book,
  onBack,
  onAdded,
}: {
  book: AddableBook;
  /** Omit to hide the back button (when the form isn't part of a search flow). */
  onBack?: () => void;
  onAdded: (result: UpsertShelfResponse) => void;
}) {
  const [status, setStatus] = useState<ShelfStatus>("read");
  const [rating, setRating] = useState<string>("");
  const [finishedOn, setFinishedOn] = useState("");

  const mutation = useMutation({
    mutationFn: (input: UpsertShelfEntryInput) =>
      apiFetch<UpsertShelfResponse>("/api/shelf", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: onAdded,
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    const target = book.bookId
      ? { bookId: book.bookId }
      : book.olWorkId
        ? { olWorkId: book.olWorkId }
        : null;
    if (!target) return;
    mutation.mutate({
      ...target,
      status,
      rating: rating ? Number(rating) : null,
      finishedOn: finishedOn || null,
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="flex items-center gap-3">
        <BookCover coverId={book.coverId} title={book.title} />
        <div className="min-w-0">
          <p className="font-medium">{book.title}</p>
          <p className="text-sm text-muted-foreground">
            {[book.authors.join(", "), book.firstPublishYear].filter(Boolean).join(" · ")}
          </p>
        </div>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Status</legend>
        <div className="flex flex-wrap gap-2">
          {SHELF_STATUSES.map((value) => (
            <label
              key={value}
              className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm has-checked:border-primary has-checked:bg-muted has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
            >
              <input
                type="radio"
                name="status"
                value={value}
                checked={status === value}
                onChange={() => setStatus(value)}
                className="sr-only"
              />
              {SHELF_STATUS_LABELS[value]}
            </label>
          ))}
        </div>
      </fieldset>

      {status !== "want" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="rating">Rating (optional)</Label>
            <select
              id="rating"
              value={rating}
              onChange={(event) => setRating(event.target.value)}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            >
              <option value="">No rating</option>
              {[5, 4, 3, 2, 1].map((n) => (
                <option key={n} value={n}>
                  {"★".repeat(n)} ({n})
                </option>
              ))}
            </select>
          </div>
          {status === "read" ? (
            <div className="space-y-1.5">
              <Label htmlFor="finishedOn">Finished on (optional)</Label>
              <Input
                id="finishedOn"
                type="date"
                value={finishedOn}
                onChange={(event) => setFinishedOn(event.target.value)}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {mutation.error ? <ApiErrorMessage error={mutation.error} /> : null}

      <div className="flex justify-between gap-2">
        {onBack ? (
          <Button type="button" variant="ghost" onClick={onBack}>
            Back to results
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit" disabled={mutation.isPending || mutation.isSuccess}>
          {mutation.isPending ? "Adding…" : "Add to shelf"}
        </Button>
      </div>
    </form>
  );
}
