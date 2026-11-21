import type { UserMap } from "@/lib/geo/map";

/**
 * List view of a map: top countries, books by country, fictional settings, and books
 * without a setting yet. Carries the same information as the map, for every reader.
 */
export function PlaceList({ map, emptyText }: { map: UserMap; emptyText: string }) {
  const empty = map.byCountry.length === 0 && map.fictional.length === 0;

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-semibold">Where the books are set</h2>

      {empty ? <p className="text-sm text-muted-foreground">{emptyText}</p> : null}

      {map.stats.topCountries.length > 0 ? (
        <div>
          <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Top countries
          </h3>
          <ol className="mt-2 space-y-1.5" aria-label="Top countries">
            {map.stats.topCountries.map((country) => {
              const max = map.stats.topCountries[0]!.count;
              return (
                <li key={country.code} className="text-sm">
                  <div className="flex justify-between gap-2">
                    <span className="font-medium">{country.name}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {country.count} {country.count === 1 ? "book" : "books"}
                    </span>
                  </div>
                  <div aria-hidden className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${(country.count / max) * 100}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      ) : null}

      {map.byCountry.length > 0 ? (
        <ul className="space-y-3" aria-label="Books by country">
          {map.byCountry.map((country) => (
            <li key={country.code}>
              <h3 className="text-sm font-semibold">
                {country.name}{" "}
                <span className="font-normal text-muted-foreground">
                  · {country.books.length} {country.books.length === 1 ? "book" : "books"}
                </span>
              </h3>
              <ul className="mt-1 space-y-0.5 text-sm">
                {country.books.map((book) => (
                  <li key={book.bookId}>
                    <span className="italic">{book.title}</span>
                    {book.places.length ? (
                      <span className="text-primary"> — {book.places.join(", ")}</span>
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
          <h3 className="text-sm font-semibold">Fictional settings</h3>
          <ul className="mt-1 space-y-0.5 text-sm" aria-label="Fictional settings">
            {map.fictional.map((book) => (
              <li key={book.bookId}>
                <span className="italic">{book.title}</span>
                <span className="text-warm-foreground"> — {book.places.join(", ")}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {map.unplaced.length > 0 ? (
        <div>
          <h3 className="text-sm font-semibold">No setting yet</h3>
          <ul
            className="mt-1 space-y-0.5 text-sm text-muted-foreground"
            aria-label="No setting yet"
          >
            {map.unplaced.map((book) => (
              <li key={book.bookId} className="italic">
                {book.title}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
