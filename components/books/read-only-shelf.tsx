import type { ShelfEntryWithPlaces } from "@/lib/books/types";
import { SHELF_STATUS_LABELS, SHELF_STATUSES } from "@/lib/validation/shelf";
import { BookCover } from "./book-cover";
import { settingSummary } from "@/lib/books/setting-summary";

/** A reader's shelf on their public profile, grouped by status. */
export function ReadOnlyShelf({ entries }: { entries: ShelfEntryWithPlaces[] }) {
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">No books on this shelf yet.</p>;
  }
  return (
    <div className="space-y-4">
      {SHELF_STATUSES.map((status) => {
        const group = entries.filter((entry) => entry.status === status);
        if (group.length === 0) return null;
        return (
          <div key={status}>
            <h3 className="text-sm font-medium">
              {SHELF_STATUS_LABELS[status]}{" "}
              <span className="font-normal text-muted-foreground tabular-nums">{group.length}</span>
            </h3>
            <ul
              className="mt-2 divide-y rounded-lg border"
              aria-label={SHELF_STATUS_LABELS[status]}
            >
              {group.map(({ id, book, places, rating }) => (
                <li key={id} className="flex gap-3 p-3">
                  <BookCover coverId={book.coverId} title={book.title} size="sm" />
                  <div className="min-w-0 text-sm">
                    <p className="font-medium">{book.title}</p>
                    <p className="text-muted-foreground">
                      {book.authors.join(", ") || "Unknown author"}
                    </p>
                    {rating ? (
                      <p aria-label={`Rated ${rating} out of 5`}>
                        {"★".repeat(rating)}
                        <span className="text-muted-foreground">{"☆".repeat(5 - rating)}</span>
                      </p>
                    ) : null}
                    <p className="text-xs text-muted-foreground">
                      <span className="sr-only">Setting: </span>
                      {settingSummary(places)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
