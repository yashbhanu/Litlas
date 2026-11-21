"use client";

import dynamic from "next/dynamic";
import { useCallback, useState } from "react";
import { MapLayout } from "@/components/map/map-layout";
import { Skeleton } from "@/components/ui/skeleton";
import type { ExplorePinProperties } from "@/lib/books/public-types";
import { getPublicEnv } from "@/lib/env";
import { countryName } from "@/lib/geo/continents";
import { countryBounds } from "@/lib/geo/map";
import { ExploreSearch, type SearchPick } from "./explore-search";
import { SelectionBooks } from "./selection-books";
import type { ExploreFocus, ExploreSelection } from "./types";

const ExploreCanvas = dynamic(() => import("./explore-canvas"), {
  ssr: false,
  loading: () => <Skeleton className="size-full rounded-none" />,
});

/** /explore: the world map of books by setting, with search and a book list panel. */
export function ExploreView() {
  const [selection, setSelection] = useState<ExploreSelection | null>(null);
  const [focus, setFocus] = useState<ExploreFocus | null>(null);
  const [visible, setVisible] = useState<ExplorePinProperties[]>([]);
  const onVisiblePlaces = useCallback((places: ExplorePinProperties[]) => setVisible(places), []);

  function onPick(pick: SearchPick) {
    const id = Date.now();
    if (pick.kind === "country") {
      setSelection({ kind: "country", code: pick.code, name: pick.name });
      const bounds = countryBounds(pick.code);
      if (bounds) setFocus({ kind: "bounds", bounds, id });
      return;
    }
    const { place } = pick;
    setSelection({
      kind: "place",
      placeId: place.placeId,
      name: place.name,
      countryCode: place.countryCode,
    });
    if (place.lng !== null && place.lat !== null) {
      setFocus({ kind: "point", center: [place.lng, place.lat], zoom: 8, id });
    } else if (place.countryCode) {
      const bounds = countryBounds(place.countryCode);
      if (bounds) setFocus({ kind: "bounds", bounds, id });
    }
  }

  return (
    <MapLayout
      panelLabel="Explore books by place"
      map={
        <section
          aria-label="World map of books by setting"
          className="size-full"
          data-testid="explore-map"
        >
          <ExploreCanvas
            styleUrl={getPublicEnv().NEXT_PUBLIC_MAP_STYLE_URL}
            selection={selection}
            focus={focus}
            onSelect={setSelection}
            onVisiblePlaces={onVisiblePlaces}
          />
        </section>
      }
    >
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Explore</h1>
        <p className="text-sm text-muted-foreground">
          Find books set around the world. Click a pin or a country to see the books set there.
        </p>
      </div>

      <ExploreSearch onPick={onPick} />

      {selection ? (
        <SelectionBooks
          key={selection.kind === "place" ? selection.placeId : selection.code}
          selection={selection}
          onClear={() => setSelection(null)}
        />
      ) : (
        <section aria-labelledby="in-view-heading" className="space-y-2">
          <h2 id="in-view-heading" className="text-base font-semibold">
            Places on the map
          </h2>
          {visible.length === 0 ? (
            <p className="text-sm text-muted-foreground">No places with books in this area yet.</p>
          ) : (
            <ul className="divide-y rounded-lg border" aria-label="Places in view">
              {visible.map((place) => (
                <li key={place.placeId}>
                  <button
                    type="button"
                    onClick={() =>
                      setSelection({
                        kind: "place",
                        placeId: place.placeId,
                        name: place.name,
                        countryCode: place.countryCode,
                      })
                    }
                    className="flex w-full items-baseline justify-between gap-2 px-3 py-2 text-left text-sm outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <span>
                      {place.name}
                      {place.countryCode ? (
                        <span className="text-muted-foreground">
                          , {countryName(place.countryCode)}
                        </span>
                      ) : null}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {place.bookCount} {place.bookCount === 1 ? "book" : "books"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </MapLayout>
  );
}
