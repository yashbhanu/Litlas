import Link from "next/link";
import type { BookSummary } from "@/lib/books/public-types";
import { cn } from "@/lib/utils";
import { AddToShelfButton } from "./add-to-shelf-button";
import { BookCover } from "./book-cover";

/**
 * Public list of books (explore panel, place and country pages): cover, title linking to
 * the book page, author · year, where it's set, and a "+" to add it to your shelf.
 */
export function BookList({
  books,
  label,
  setting,
  className,
}: {
  books: BookSummary[];
  label: string;
  /** Setting label for books that don't carry their own (e.g. the place being listed). */
  setting?: string;
  className?: string;
}) {
  return (
    <ul className={cn("space-y-1", className)} aria-label={label}>
      {books.map((book) => {
        const where = book.setting ?? setting;
        return (
          <li
            key={book.id}
            className="group relative flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-surface"
          >
            <BookCover coverId={book.coverId} title={book.title} size="sm" />
            <div className="min-w-0 flex-1">
              <Link
                href={`/book/${book.id}`}
                className="line-clamp-2 text-sm leading-snug font-semibold outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-3 focus-visible:after:ring-ring/40"
              >
                {book.title}
              </Link>
              <p className="truncate text-xs text-muted-foreground">
                {[book.authors.join(", ") || "Unknown author", book.firstPublishYear]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              {where ? <p className="truncate text-xs font-medium text-primary">{where}</p> : null}
            </div>
            {/* Above the row's stretched link. */}
            <div className="relative z-10">
              <AddToShelfButton book={book} size="icon" />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
