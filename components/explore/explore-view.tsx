"use client";

import { useQuery } from "@tanstack/react-query";
import { MapPinIcon } from "lucide-react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { MapLayout } from "@/components/map/map-layout";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api-client";
import type { ExplorePinProperties, PlaceDetail } from "@/lib/books/public-types";
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

const COUNTRY_PARAM = /^[A-Z]{2}$/;
const UUID_PARAM = /^[0-9a-f-]{36}$/i;

/**
 * /explore: the world map of books by setting, with search and a book list panel.
 * `?country=CO` or `?place=<id>` (from the header search) opens that selection.
 */
export function ExploreView() {
  const params = useSearchParams();
  const [selection, setSelection] = useState<ExploreSelection | null>(null);
  const [focus, setFocus] = useState<ExploreFocus | null>(null);
  const [visible, setVisible] = useState<ExplorePinProperties[]>([]);
  const onVisiblePlaces = useCallback((places: ExplorePinProperties[]) => setVisible(places), []);

  const countryParam = params.get("country")?.toUpperCase() ?? null;
  const placeParam = params.get("place");

  function countrySelection(code: string, id: number | string) {
    const bounds = countryBounds(code);
    return {
      selection: { kind: "country", code, name: countryName(code) } satisfies ExploreSelection,
      focus: bounds ? ({ kind: "bounds", bounds, id } satisfies ExploreFocus) : null,
    };
  }

  function placeSelection(
    place: Pick<PlaceDetail, "id" | "name" | "countryCode" | "lng" | "lat">,
    id: number | string,
  ) {
    const bounds = place.countryCode ? countryBounds(place.countryCode) : null;
    return {
      selection: {
        kind: "place",
        placeId: place.id,
        name: place.name,
        countryCode: place.countryCode,
      } satisfies ExploreSelection,
      focus:
        place.lng !== null && place.lat !== null
          ? ({ kind: "point", center: [place.lng, place.lat], zoom: 8, id } satisfies ExploreFocus)
          : bounds
            ? ({ kind: "bounds", bounds, id } satisfies ExploreFocus)
            : null,
    };
  }

  function apply(next: { selection: ExploreSelection; focus: ExploreFocus | null }) {
    setSelection(next.selection);
    if (next.focus) setFocus(next.focus);
  }

  // Deep links from the header search (?country=CO, ?place=<id>). Applied while
  // rendering when the URL changes (React's "adjust state on prop change" pattern).
  const linkedPlace = useQuery({
    queryKey: ["linked-place", placeParam],
    queryFn: ({ signal }) =>
      apiFetch<{ place: PlaceDetail }>(`/api/places/${placeParam}/books?page=1`, { signal }),
    enabled: !!placeParam && UUID_PARAM.test(placeParam),
  });
  const linkKey = countryParam
    ? `country:${countryParam}`
    : linkedPlace.data
      ? `place:${linkedPlace.data.place.id}`
      : null;
  const [appliedLink, setAppliedLink] = useState<string | null>(null);
  if (linkKey !== appliedLink) {
    setAppliedLink(linkKey);
    if (countryParam && COUNTRY_PARAM.test(countryParam))
      apply(countrySelection(countryParam, linkKey!));
    else if (linkedPlace.data) apply(placeSelection(linkedPlace.data.place, linkKey!));
  }

  function onPick(pick: SearchPick) {
    const id = Date.now();
    if (pick.kind === "country") apply(countrySelection(pick.code, id));
    else
      apply(
        placeSelection(
          {
            id: pick.place.placeId,
            name: pick.place.name,
            countryCode: pick.place.countryCode,
            lng: pick.place.lng,
            lat: pick.place.lat,
          },
          id,
        ),
      );
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
      {selection ? (
        <SelectionBooks
          key={selection.kind === "place" ? selection.placeId : selection.code}
          selection={selection}
          onClear={() => setSelection(null)}
        />
      ) : (
        <>
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Explore</p>
            <h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">
              Read around the world
            </h1>
            <p className="text-sm text-muted-foreground">
              Click a pin or a country to see the books set there.
            </p>
          </div>

          <ExploreSearch onPick={onPick} />

          <section aria-labelledby="in-view-heading" className="space-y-2">
            <h2 id="in-view-heading" className="text-sm font-semibold">
              Places on the map
            </h2>
            {visible.length === 0 ? (
              <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                No places with books in this area yet.
              </p>
            ) : (
              <ul className="-mx-2 space-y-0.5" aria-label="Places in view">
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
                      className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left text-sm outline-none hover:bg-surface focus-visible:ring-3 focus-visible:ring-ring/40"
                    >
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#e07a1f]/10 text-[#e07a1f]">
                        <MapPinIcon aria-hidden className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{place.name}</span>
                        {place.countryCode ? (
                          <span className="block truncate text-xs text-muted-foreground">
                            {countryName(place.countryCode)}
                          </span>
                        ) : null}
                      </span>
                      <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground tabular-nums">
                        {place.bookCount} {place.bookCount === 1 ? "book" : "books"}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </MapLayout>
  );
}
