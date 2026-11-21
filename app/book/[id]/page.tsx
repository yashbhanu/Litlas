import { MapPinPlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AddToShelfButton } from "@/components/books/add-to-shelf-button";
import { BookCover } from "@/components/books/book-cover";
import { MapView } from "@/components/map/map-view";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getBookDetail } from "@/lib/db/public";
import { countryName } from "@/lib/geo/continents";
import { buildPins, type BookPlace } from "@/lib/geo/map";
import { uuidSchema } from "@/lib/validation/explore";

async function loadBook(params: PageProps<"/book/[id]">["params"]) {
  const id = uuidSchema.safeParse((await params).id);
  return id.success ? getBookDetail(id.data) : null;
}

export async function generateMetadata({ params }: PageProps<"/book/[id]">): Promise<Metadata> {
  const book = await loadBook(params);
  if (!book) return { title: "Book not found" };
  const by = book.authors.length ? ` by ${book.authors.join(", ")}` : "";
  const where = book.places.filter((p) => p.precision !== "fictional").map((p) => p.name);
  return {
    title: `${book.title}${by}`,
    description: where.length
      ? `Where ${book.title} is set: ${where.slice(0, 5).join(", ")}.`
      : `${book.title}${by} on Literary World Map.`,
  };
}

/** Book page: details, its settings on a mini map, and where each location came from. */
export default function BookPage({ params }: PageProps<"/book/[id]">) {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <BookContent params={params} />
      </Suspense>
    </main>
  );
}

const SOURCE_LABELS: Record<BookPlace["source"], string> = {
  wikidata: "From Wikidata",
  user: "Suggested by readers",
  admin: "Added by a moderator",
};

async function BookContent({ params }: { params: PageProps<"/book/[id]">["params"] }) {
  const book = await loadBook(params);
  if (!book) notFound();

  const real = book.places.filter((place) => place.precision !== "fictional");
  const fictional = book.places.filter((place) => place.precision === "fictional");
  const pins = buildPins([book], book.places);
  const countries = [
    ...new Set(real.flatMap((p) => (p.countryCode ? [p.countryCode] : []))),
  ].sort();

  return (
    <article className="space-y-8">
      <header className="flex flex-col gap-6 sm:flex-row">
        <BookCover coverId={book.coverId} title={book.title} size="lg" />
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight">{book.title}</h1>
          <p className="text-muted-foreground">
            {[book.authors.join(", ") || "Unknown author", book.firstPublishYear]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <AddToShelfButton book={book} size="default" />
          {book.description ? (
            <p className="max-w-prose text-sm leading-relaxed whitespace-pre-line">
              {book.description}
            </p>
          ) : null}
        </div>
      </header>

      <section aria-labelledby="settings-heading" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="settings-heading" className="text-xl font-semibold">
            Where it&apos;s set
          </h2>
          <Button variant="outline" size="sm" disabled title="Coming soon">
            <MapPinPlusIcon aria-hidden />
            Suggest a location (coming soon)
          </Button>
        </div>

        {real.length > 0 ? (
          <>
            <div className="h-72 overflow-hidden rounded-lg border">
              <MapView
                pins={pins}
                countries={countries}
                label={`Map of where ${book.title} is set`}
              />
            </div>
            <ul className="divide-y rounded-lg border text-sm" aria-label="Settings">
              {real.map((place) => (
                <li key={place.placeId} className="flex flex-wrap justify-between gap-2 p-3">
                  <span>
                    <Link
                      href={`/place/${place.placeId}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {place.name}
                    </Link>
                    {place.countryCode && place.precision !== "country" ? (
                      <span className="text-muted-foreground">
                        {" "}
                        · {countryName(place.countryCode)}
                      </span>
                    ) : null}
                  </span>
                  <span className="text-muted-foreground">{SOURCE_LABELS[place.source]}</span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            {fictional.length
              ? "This book is only set in fictional places."
              : "We don't know where this book is set yet."}
          </p>
        )}

        {fictional.length > 0 ? (
          <div>
            <h3 className="text-sm font-medium">Fictional settings</h3>
            <ul className="mt-1 text-sm" aria-label="Fictional settings">
              {fictional.map((place) => (
                <li key={place.placeId}>
                  {place.name}{" "}
                  <span className="text-muted-foreground">· {SOURCE_LABELS[place.source]}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <footer className="border-t pt-4 text-xs text-muted-foreground">
        Book data from{" "}
        {book.olWorkId ? (
          <a className="underline" href={`https://openlibrary.org/works/${book.olWorkId}`}>
            Open Library
          </a>
        ) : (
          "Open Library"
        )}
        ; settings from{" "}
        {book.wikidataId ? (
          <a className="underline" href={`https://www.wikidata.org/wiki/${book.wikidataId}`}>
            Wikidata
          </a>
        ) : (
          "Wikidata"
        )}{" "}
        and readers.
      </footer>
    </article>
  );
}
