"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import { getPublicEnv } from "@/lib/env";
import type { PinCollection } from "@/lib/geo/map";

// MapLibre needs WebGL and `window`, so the map only renders in the browser.
const MapCanvas = dynamic(() => import("./map-canvas"), {
  ssr: false,
  loading: () => <Skeleton className="size-full rounded-none" />,
});

/**
 * The map, with a text summary for screen readers. Every map is paired with a list
 * view (PlaceList) that carries the same information.
 */
export function MapView({
  pins,
  countries,
  label,
  showLegend = false,
}: {
  pins: PinCollection;
  countries: string[];
  label: string;
  showLegend?: boolean;
}) {
  const summary = `${pins.features.length} ${pins.features.length === 1 ? "pin" : "pins"} and ${countries.length} shaded ${countries.length === 1 ? "country" : "countries"}. The list next to the map has the same information.`;

  return (
    <section aria-label={label} className="relative size-full" data-testid="map">
      <p className="sr-only">{summary}</p>
      <MapCanvas
        pins={pins}
        countries={countries}
        styleUrl={getPublicEnv().NEXT_PUBLIC_MAP_STYLE_URL}
        showLegend={showLegend}
      />
    </section>
  );
}
