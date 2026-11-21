import Link from "next/link";
import { BookCover } from "@/components/books/book-cover";
import type { ShelfEntryWithPlaces } from "@/lib/books/types";
import type { BookPlace } from "@/lib/geo/map";

// Cities and places first (already most notable first from the API), then areas.
const ORDER: Record<BookPlace["precision"], number> = {
  city: 0,
  point: 0,
  region: 1,
  country: 2,
  fictional: 3,
};

function primaryPlace(places: BookPlace[]): string | null {
  return [...places].sort((a, b) => ORDER[a.precision] - ORDER[b.precision])[0]?.name ?? null;
}

/** The latest books marked read (finish date, else when added). */
export function RecentlyRead({
  entries,
  limit = 4,
  shelfHref = "#shelf",
}: {
  entries: ShelfEntryWithPlaces[];
  limit?: number;
  shelfHref?: string;
}) {
  const recent = entries
    .filter((entry) => entry.status === "read")
    .sort((a, b) =>
      (b.finishedOn ?? b.createdAt ?? "").localeCompare(a.finishedOn ?? a.createdAt ?? ""),
    )
    .slice(0, limit);
  if (recent.length === 0) return null;

  return (
    <section aria-labelledby="recent-heading" className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 id="recent-heading" className="text-lg font-semibold">
          Recently read
        </h2>
        <a
          href={shelfHref}
          className="text-sm font-medium text-primary underline underline-offset-4 hover:no-underline"
        >
          Shelf
        </a>
      </div>
      <ul className="space-y-2" aria-label="Recently read">
        {recent.map(({ id, book, places }) => {
          const place = primaryPlace(places);
          return (
            <li key={id}>
              <Link
                href={`/book/${book.id}`}
                className="flex items-center gap-3 rounded-2xl border bg-background p-3 shadow-xs transition-colors outline-none hover:bg-surface focus-visible:ring-3 focus-visible:ring-ring/40 lg:shadow-none"
              >
                <BookCover coverId={book.coverId} title={book.title} size="sm" />
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{book.title}</span>
                  <span className="block truncate text-sm text-muted-foreground">
                    {[book.authors[0] ?? "Unknown author", place].filter(Boolean).join(" · ")}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
