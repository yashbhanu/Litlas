"use client";

import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiErrorMessage } from "@/components/api-error-message";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";
import type { ModerationItem } from "@/lib/db/locations";
import { countryName } from "@/lib/geo/continents";
import { APPROVAL_THRESHOLD } from "@/lib/locations/constants";
import type { ModerateLocationInput } from "@/lib/validation/locations";

export function ModerationQueue({ items }: { items: ModerationItem[] }) {
  if (items.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
        No pending suggestions. 🎉
      </p>
    );
  }
  return (
    <ul className="space-y-3" aria-label="Pending suggestions">
      {items.map((item) => (
        <QueueItem key={item.bookPlaceId} item={item} />
      ))}
    </ul>
  );
}

function QueueItem({ item }: { item: ModerationItem }) {
  const router = useRouter();
  const action = useMutation({
    mutationFn: (input: ModerateLocationInput) =>
      apiFetch<{ ok: true }>(`/api/admin/locations/${item.bookPlaceId}`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => router.refresh(),
  });
  const where =
    item.countryCode && item.precision !== "country" ? `, ${countryName(item.countryCode)}` : "";

  return (
    <li
      className="space-y-3 rounded-lg border p-4"
      aria-label={`${item.placeName} for ${item.bookTitle}`}
      aria-busy={action.isPending || undefined}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="text-sm">
          <p>
            <span className="font-medium">
              {item.placeName}
              {where}
            </span>{" "}
            <span className="text-muted-foreground">({item.precision})</span> for{" "}
            <Link
              href={`/book/${item.bookId}`}
              className="italic underline-offset-4 hover:underline"
            >
              {item.bookTitle}
            </Link>
          </p>
          <p className="text-xs text-muted-foreground">
            Suggested by {item.suggestedBy ? `@${item.suggestedBy}` : "a deleted account"} ·{" "}
            {new Date(item.createdAt).toLocaleDateString()} · {item.votes} of {APPROVAL_THRESHOLD}{" "}
            confirmations
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            disabled={action.isPending}
            onClick={() => action.mutate({ action: "approve" })}
          >
            Approve
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={action.isPending}
            onClick={() => action.mutate({ action: "reject" })}
          >
            Reject
          </Button>
        </div>
      </div>

      {item.duplicates.length > 0 ? (
        <div className="space-y-1 text-sm">
          <p className="text-xs font-medium text-muted-foreground">Possible duplicates</p>
          <ul
            className="divide-y rounded-md border"
            aria-label={`Possible duplicates of ${item.placeName}`}
          >
            {item.duplicates.map((dupe) => (
              <li
                key={dupe.id}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
              >
                <span>
                  {dupe.name}
                  {dupe.countryCode && dupe.precision !== "country"
                    ? `, ${countryName(dupe.countryCode)}`
                    : ""}{" "}
                  <span className="text-xs text-muted-foreground">
                    ({dupe.precision} · from {dupe.source} · {dupe.links}{" "}
                    {dupe.links === 1 ? "book" : "books"})
                  </span>
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={action.isPending}
                  onClick={() => action.mutate({ action: "merge", intoPlaceId: dupe.id })}
                  aria-label={`Merge ${item.placeName} into ${dupe.name}`}
                >
                  Merge into this
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {action.error ? <ApiErrorMessage error={action.error} /> : null}
    </li>
  );
}
