import type { MapStats } from "@/lib/geo/map";
import { cn } from "@/lib/utils";

/** Books read · countries · continents, as three cards (see mockup). */
export function StatCards({ stats }: { stats: MapStats }) {
  const items = [
    {
      label: stats.booksRead === 1 ? "book" : "books",
      value: stats.booksRead,
      accent: false,
    },
    {
      label: stats.countries === 1 ? "country" : "countries",
      value: stats.countries,
      accent: true,
    },
    {
      label: stats.continents === 1 ? "continent" : "continents",
      value: stats.continents,
      accent: false,
    },
  ];
  return (
    <dl className="grid grid-cols-3 gap-3" data-testid="stats">
      {items.map(({ label, value, accent }) => (
        // dt must come first in the markup; flex-col-reverse shows the number on top.
        <div
          key={label}
          className="flex flex-col-reverse rounded-2xl border bg-background px-4 py-3.5 shadow-xs lg:shadow-none"
        >
          <dt className="text-sm text-muted-foreground">{label}</dt>
          <dd
            className={cn(
              "font-heading text-3xl font-semibold tracking-tight tabular-nums",
              accent && "text-primary",
            )}
          >
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
