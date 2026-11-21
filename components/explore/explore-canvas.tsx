"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { GeoJSONSource, Map as MaplibreMap } from "maplibre-gl";
import { useCallback, useEffect, useRef, useState } from "react";
import Map, {
  Layer,
  NavigationControl,
  Source,
  type MapLayerMouseEvent,
  type MapRef,
} from "react-map-gl/maplibre";
import { MapLegend } from "@/components/map/map-legend";
import { MAP_COLORS, tuneBasemap } from "@/components/map/maplibre-setup";
import { apiFetch } from "@/lib/api-client";
import type { ExplorePinProperties, ExploreResponse } from "@/lib/books/public-types";
import { bboxContains, formatBbox, normalizeBbox, requestBbox, type Bbox } from "@/lib/geo/bbox";
import type { ExploreFocus, ExploreSelection } from "./types";

const EMPTY: ExploreResponse = { type: "FeatureCollection", features: [], truncated: false };
const VISIBLE_LIST_SIZE = 20;

interface Request {
  bbox: Bbox;
  zoom: number;
}

function viewBbox(map: MaplibreMap): Bbox {
  const bounds = map.getBounds();
  return [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()];
}

/** Places in `data` inside the current viewport, most-read first (the map's list view). */
function placesInView(data: ExploreResponse, view: Bbox): ExplorePinProperties[] {
  const boxes = normalizeBbox(view);
  return data.features
    .filter(
      ({
        geometry: {
          coordinates: [lng, lat],
        },
      }) => boxes.some(([w, s, e, n]) => lng >= w && lng <= e && lat >= s && lat <= n),
    )
    .slice(0, VISIBLE_LIST_SIZE)
    .map((feature) => feature.properties);
}

/**
 * Explore map. Loads pins for the visible area only: on every move it checks whether the
 * viewport is still inside the last requested box (which is padded and grid-snapped) and
 * only then fetches. Previous pins stay on screen while new ones load.
 */
export default function ExploreCanvas({
  styleUrl,
  selection,
  focus,
  onSelect,
  onVisiblePlaces,
}: {
  styleUrl: string;
  selection: ExploreSelection | null;
  focus: ExploreFocus | null;
  onSelect: (selection: ExploreSelection) => void;
  onVisiblePlaces: (places: ExplorePinProperties[]) => void;
}) {
  const mapRef = useRef<MapRef>(null);
  const [request, setRequest] = useState<Request | null>(null);
  const [cursor, setCursor] = useState("");
  const [hoveredCountry, setHoveredCountry] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["explore", request ? formatBbox(request.bbox) : null, request?.zoom],
    queryFn: ({ signal }) =>
      apiFetch<ExploreResponse>(
        `/api/explore?bbox=${formatBbox(request!.bbox)}&zoom=${request!.zoom}`,
        { signal },
      ),
    enabled: request !== null,
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
  });
  const data = query.data ?? EMPTY;

  const truncatedRef = useRef(false);
  useEffect(() => {
    truncatedRef.current = query.data?.truncated ?? false;
  }, [query.data]);

  const refresh = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    const view = viewBbox(map);
    const zoom = Math.floor(map.getZoom());
    setRequest((previous) => {
      const covered = previous && bboxContains(previous.bbox, view);
      // A capped result only has the most-read places; zooming in fetches the rest.
      const needsDetail = previous && truncatedRef.current && zoom > previous.zoom;
      if (covered && !needsDetail) return previous;
      return { bbox: requestBbox(view, zoom), zoom };
    });
  }, []);

  // Keep the list view in sync with what's on screen.
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (map) onVisiblePlaces(placesInView(data, viewBbox(map)));
  }, [data, onVisiblePlaces]);

  const onMoveEnd = useCallback(() => {
    refresh();
    const map = mapRef.current?.getMap();
    if (map) onVisiblePlaces(placesInView(data, viewBbox(map)));
  }, [data, onVisiblePlaces, refresh]);

  // Fly to a search result.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focus) return;
    if (focus.kind === "point") {
      map.flyTo({ center: focus.center, zoom: Math.max(map.getZoom(), focus.zoom) });
    } else {
      map.fitBounds(focus.bounds, { padding: 40, maxZoom: 6 });
    }
  }, [focus]);

  function onMouseMove(event: MapLayerMouseEvent) {
    const feature = event.features?.[0];
    setCursor(feature ? "pointer" : "");
    const iso = feature?.layer.id === "countries-hit" ? feature.properties.iso : null;
    setHoveredCountry(typeof iso === "string" ? iso : null);
  }

  async function onClick(event: MapLayerMouseEvent) {
    const feature = event.features?.[0];
    if (!feature) return;
    const props = feature.properties;
    if (feature.layer.id === "explore-clusters" && feature.geometry.type === "Point") {
      const source = mapRef.current?.getSource<GeoJSONSource>("explore");
      if (!source || typeof props.cluster_id !== "number") return;
      const zoom = await source.getClusterExpansionZoom(props.cluster_id);
      mapRef.current?.easeTo({
        center: feature.geometry.coordinates as [number, number],
        zoom,
      });
    } else if (feature.layer.id === "explore-pins") {
      if (typeof props.placeId !== "string" || typeof props.name !== "string") return;
      onSelect({
        kind: "place",
        placeId: props.placeId,
        name: props.name,
        countryCode: typeof props.countryCode === "string" ? props.countryCode : null,
      });
    } else if (feature.layer.id === "countries-hit") {
      if (typeof props.iso !== "string" || typeof props.name !== "string") return;
      onSelect({ kind: "country", code: props.iso, name: props.name });
    }
  }

  const selectedCountry = selection?.kind === "country" ? selection.code : "";
  const selectedPlace = selection?.kind === "place" ? selection.placeId : "";

  return (
    <div className="relative size-full">
      <Map
        ref={mapRef}
        initialViewState={{ longitude: 10, latitude: 30, zoom: 1.2 }}
        // Keep the view in the URL (#zoom/lat/lng) so it can be shared and restored.
        hash
        mapStyle={styleUrl}
        style={{ width: "100%", height: "100%" }}
        interactiveLayerIds={["explore-clusters", "explore-pins", "countries-hit"]}
        cursor={cursor}
        onLoad={(event) => {
          tuneBasemap(event.target);
          refresh();
        }}
        onMoveEnd={onMoveEnd}
        onMouseMove={onMouseMove}
        onMouseLeave={() => {
          setCursor("");
          setHoveredCountry(null);
        }}
        onClick={onClick}
        attributionControl={{ compact: true }}
        dragRotate={false}
        touchPitch={false}
      >
        <NavigationControl position="top-right" showCompass={false} />

        <Source id="countries" type="geojson" data="/geo/countries.geojson">
          {/* Invisible fill so any country can be clicked. */}
          <Layer
            id="countries-hit"
            type="fill"
            paint={{ "fill-color": "#000000", "fill-opacity": 0 }}
          />
          <Layer
            id="countries-selected"
            type="fill"
            filter={["==", ["get", "iso"], selectedCountry]}
            paint={{ "fill-color": MAP_COLORS.country, "fill-opacity": 0.75 }}
          />
          <Layer
            id="countries-hover"
            type="line"
            filter={["==", ["get", "iso"], hoveredCountry ?? ""]}
            paint={{ "line-color": MAP_COLORS.country, "line-width": 2 }}
          />
        </Source>

        <Source
          id="explore"
          type="geojson"
          data={data}
          cluster
          clusterMaxZoom={10}
          clusterRadius={45}
          clusterProperties={{ bookCount: ["+", ["get", "bookCount"]] }}
        >
          <Layer
            id="explore-clusters"
            type="circle"
            filter={["has", "point_count"]}
            paint={{
              "circle-color": MAP_COLORS.cluster,
              "circle-opacity": 0.85,
              "circle-radius": ["step", ["get", "bookCount"], 14, 20, 18, 200, 24, 1000, 30],
              "circle-stroke-color": "#ffffff",
              "circle-stroke-width": 2,
            }}
          />
          <Layer
            id="explore-cluster-count"
            type="symbol"
            filter={["has", "point_count"]}
            layout={{
              "text-field": ["to-string", ["get", "bookCount"]],
              "text-font": ["Noto Sans Bold"],
              "text-size": 12,
              "text-allow-overlap": true,
            }}
            paint={{ "text-color": "#ffffff" }}
          />
          <Layer
            id="explore-pins"
            type="circle"
            filter={["!", ["has", "point_count"]]}
            paint={{
              "circle-color": MAP_COLORS.pin,
              "circle-radius": [
                "interpolate",
                ["linear"],
                ["get", "bookCount"],
                1,
                6,
                10,
                9,
                50,
                13,
              ],
              "circle-stroke-color": "#ffffff",
              "circle-stroke-width": 2,
            }}
          />
          <Layer
            id="explore-pins-selected"
            type="circle"
            filter={[
              "all",
              ["!", ["has", "point_count"]],
              ["==", ["get", "placeId"], selectedPlace],
            ]}
            paint={{
              "circle-color": MAP_COLORS.highlight,
              "circle-radius": 10,
              "circle-stroke-color": "#ffffff",
              "circle-stroke-width": 2,
            }}
          />
        </Source>
      </Map>
      <MapLegend />

      <div
        aria-live="polite"
        className="pointer-events-none absolute top-2 left-2 flex flex-col items-start gap-1 text-xs"
      >
        {query.isFetching ? (
          <span className="rounded-md bg-background/90 px-2 py-1 shadow">Loading places…</span>
        ) : null}
        {data.truncated ? (
          <span className="rounded-md bg-background/90 px-2 py-1 shadow">
            Showing the most-read places. Zoom in for more.
          </span>
        ) : null}
        {query.isError ? (
          <span className="rounded-md bg-destructive/10 px-2 py-1 text-destructive shadow">
            Couldn&apos;t load places. Move the map to retry.
          </span>
        ) : null}
      </div>
    </div>
  );
}
