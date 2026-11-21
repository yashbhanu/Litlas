import type { UserMap } from "@/lib/geo/map";

/** List view of a map: books by country, fictional settings, and books without a setting. */
export function PlaceList({ map, emptyText }: { map: UserMap; emptyText: string }) {
  const empty = map.byCountry.length === 0 && map.fictional.length === 0;

  return (
    <section aria-labelledby="places-heading" className="space-y-4">
      <h2 id="places-heading" className="text-base font-semibold">
        Where the books are set
      </h2>

      {empty ? <p className="text-sm text-muted-foreground">{emptyText}</p> : null}

      {map.byCountry.length > 0 ? (
        <ul className="space-y-3" aria-label="Books by country">
          {map.byCountry.map((country) => (
            <li key={country.code}>
              <h3 className="text-sm font-medium">
                {country.name}{" "}
                <span className="font-normal text-muted-foreground">
                  · {country.books.length} {country.books.length === 1 ? "book" : "books"}
                </span>
              </h3>
              <ul className="mt-1 space-y-1 text-sm">
                {country.books.map((book) => (
                  <li key={book.bookId}>
                    <span className="italic">{book.title}</span>
                    {book.places.length ? (
                      <span className="text-muted-foreground"> — {book.places.join(", ")}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      ) : null}

      {map.fictional.length > 0 ? (
        <div>
          <h3 className="text-sm font-medium">Fictional settings</h3>
          <ul className="mt-1 space-y-1 text-sm" aria-label="Fictional settings">
            {map.fictional.map((book) => (
              <li key={book.bookId}>
                <span className="italic">{book.title}</span>
                <span className="text-muted-foreground"> — {book.places.join(", ")}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {map.unplaced.length > 0 ? (
        <div>
          <h3 className="text-sm font-medium">No setting yet</h3>
          <ul className="mt-1 space-y-1 text-sm text-muted-foreground" aria-label="No setting yet">
            {map.unplaced.map((book) => (
              <li key={book.bookId} className="italic">
                {book.title}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
