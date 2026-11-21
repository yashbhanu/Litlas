"use client";

import { useMutation } from "@tanstack/react-query";
import { MapPinIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";
import type { ShelfEntryWithPlaces } from "@/lib/books/types";
import { settingSummary } from "@/lib/books/setting-summary";
import type { BookPlace } from "@/lib/geo/map";
import {
  SHELF_STATUSES,
  SHELF_STATUS_LABELS,
  type ShelfStatus,
  type UpsertShelfEntryInput,
} from "@/lib/validation/shelf";
import { BookCover } from "./book-cover";

type Filter = "all" | ShelfStatus;

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  ...SHELF_STATUSES.map((value) => ({ value, label: SHELF_STATUS_LABELS[value] })),
];

export function ShelfList({ entries }: { entries: ShelfEntryWithPlaces[] }) {
  const [filter, setFilter] = useState<Filter>("all");

  const counts = { all: entries.length, read: 0, reading: 0, want: 0 };
  for (const entry of entries) counts[entry.status]++;

  const visible = filter === "all" ? entries : entries.filter((e) => e.status === filter);

  return (
    <div className="space-y-4">
      <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-2">
        {FILTERS.map(({ value, label }) => (
          <Button
            key={value}
            size="sm"
            variant={filter === value ? "secondary" : "outline"}
            className="rounded-full"
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
          >
            {label} <span className="tabular-nums opacity-70">{counts[value]}</span>
          </Button>
        ))}
      </div>

      {entries.length === 0 ? (
        <p className="rounded-2xl border border-dashed bg-background p-8 text-center text-sm text-muted-foreground">
          Your shelf is empty. Add the first book you&apos;ve read.
        </p>
      ) : visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">No books with this status yet.</p>
      ) : (
        <ul className="space-y-2" aria-label="Books on your shelf">
          {visible.map((entry) => (
            <ShelfItem key={entry.id} entry={entry} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ShelfItem({ entry }: { entry: ShelfEntryWithPlaces }) {
  const router = useRouter();
  const { book } = entry;

  const update = useMutation({
    mutationFn: (input: UpsertShelfEntryInput) =>
      apiFetch("/api/shelf", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => router.refresh(),
  });

  const remove = useMutation({
    mutationFn: () => apiFetch(`/api/shelf/${entry.id}`, { method: "DELETE" }),
    onSuccess: () => router.refresh(),
  });

  const error = update.error ?? remove.error;
  const busy = update.isPending || remove.isPending || remove.isSuccess;

  return (
    <li
      className="flex gap-3 rounded-2xl border bg-background p-3 shadow-xs lg:shadow-none"
      aria-busy={busy || undefined}
    >
      <BookCover coverId={book.coverId} title={book.title} />
      <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <a href={`/book/${book.id}`} className="font-semibold underline-offset-4 hover:underline">
            {book.title}
          </a>
          <p className="text-sm text-muted-foreground">
            {[book.authors.join(", "), book.firstPublishYear].filter(Boolean).join(" · ") ||
              "Unknown author"}
          </p>
          {entry.rating ? (
            <p className="text-sm" aria-label={`Rated ${entry.rating} out of 5`}>
              {"★".repeat(entry.rating)}
              <span className="text-muted-foreground">{"☆".repeat(5 - entry.rating)}</span>
            </p>
          ) : null}
          <SettingSummary places={entry.places} />
          {entry.finishedOn ? (
            <p className="text-xs text-muted-foreground">Finished {entry.finishedOn}</p>
          ) : null}
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error.message}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <label className="sr-only" htmlFor={`status-${entry.id}`}>
            Status for {book.title}
          </label>
          <select
            id={`status-${entry.id}`}
            value={entry.status}
            disabled={busy}
            onChange={(event) =>
              update.mutate({
                bookId: book.id,
                status: event.target.value as ShelfStatus,
                rating: entry.rating,
                finishedOn: entry.finishedOn,
              })
            }
            className="h-7 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          >
            {SHELF_STATUSES.map((value) => (
              <option key={value} value={value}>
                {SHELF_STATUS_LABELS[value]}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => remove.mutate()}
            aria-label={`Remove ${book.title} from shelf`}
          >
            Remove
          </Button>
        </div>
      </div>
    </li>
  );
}

function SettingSummary({ places }: { places: BookPlace[] }) {
  return (
    <p className="flex items-start gap-1 text-xs text-muted-foreground">
      <MapPinIcon aria-hidden className="mt-px size-3 shrink-0" />
      <span>
        <span className="sr-only">Setting: </span>
        {settingSummary(places)}
      </span>
    </p>
  );
}
