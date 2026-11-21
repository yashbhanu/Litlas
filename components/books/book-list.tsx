import Link from "next/link";
import type { BookSummary } from "@/lib/books/public-types";
import { AddToShelfButton } from "./add-to-shelf-button";
import { BookCover } from "./book-cover";

/** Public list of books: cover, title (links to the book page), author, Add to shelf. */
export function BookList({ books, label }: { books: BookSummary[]; label: string }) {
  return (
    <ul className="divide-y rounded-lg border" aria-label={label}>
      {books.map((book) => (
        <li key={book.id} className="flex items-start gap-3 p-3">
          <BookCover coverId={book.coverId} title={book.title} size="sm" />
          <div className="min-w-0 flex-1 text-sm">
            <Link
              href={`/book/${book.id}`}
              className="font-medium underline-offset-4 hover:underline"
            >
              {book.title}
            </Link>
            <p className="text-muted-foreground">
              {[book.authors.join(", ") || "Unknown author", book.firstPublishYear]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <AddToShelfButton book={book} />
        </li>
      ))}
    </ul>
  );
}
