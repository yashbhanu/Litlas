import type { MapStats } from "@/lib/geo/map";

export function StatsBar({ stats }: { stats: MapStats }) {
  const items = [
    { label: stats.booksRead === 1 ? "Book read" : "Books read", value: stats.booksRead },
    { label: stats.countries === 1 ? "Country" : "Countries", value: stats.countries },
    { label: stats.continents === 1 ? "Continent" : "Continents", value: stats.continents },
  ];

  return (
    <section aria-labelledby="stats-heading" className="space-y-3">
      <h2 id="stats-heading" className="sr-only">
        Reading stats
      </h2>
      <dl className="grid grid-cols-3 gap-2" data-testid="stats">
        {items.map(({ label, value }) => (
          // dt must come first in the markup; flex-col-reverse shows the number on top.
          <div key={label} className="flex flex-col-reverse rounded-lg border p-3 text-center">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="text-2xl font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      {stats.topCountries.length > 0 ? (
        <div>
          <h3 className="text-sm font-medium">Top countries</h3>
          <ol className="mt-1 space-y-0.5 text-sm" aria-label="Top countries">
            {stats.topCountries.map((country) => (
              <li key={country.code} className="flex justify-between gap-2">
                <span>{country.name}</span>
                <span className="text-muted-foreground tabular-nums">
                  {country.count} {country.count === 1 ? "book" : "books"}
                </span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </section>
  );
}
