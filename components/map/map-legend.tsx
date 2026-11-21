import { MAP_COLORS } from "./maplibre-setup";

/** Map key: pin, cluster, shaded country. */
export function MapLegend({ countryLabel = "Selected country" }: { countryLabel?: string }) {
  return (
    <ul
      aria-label="Map legend"
      className="pointer-events-none absolute bottom-3 left-3 z-10 hidden items-center gap-4 rounded-xl border bg-background/95 px-3 py-2 text-xs shadow-sm sm:flex"
    >
      <li className="flex items-center gap-1.5">
        <span
          aria-hidden
          className="size-2.5 rounded-full"
          style={{ background: MAP_COLORS.pin }}
        />
        A book&apos;s city
      </li>
      <li className="flex items-center gap-1.5">
        <span
          aria-hidden
          className="size-3.5 rounded-full"
          style={{ background: MAP_COLORS.cluster }}
        />
        Cluster of books
      </li>
      <li className="flex items-center gap-1.5">
        <span
          aria-hidden
          className="size-3 rounded-[3px]"
          style={{ background: MAP_COLORS.country }}
        />
        {countryLabel}
      </li>
    </ul>
  );
}
