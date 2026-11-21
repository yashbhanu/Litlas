"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import type { FilterSpecification, GeoJSONSource } from "maplibre-gl";
import { useMemo, useRef, useState } from "react";
import Map, {
  Layer,
  NavigationControl,
  Popup,
  Source,
  type MapLayerMouseEvent,
  type MapRef,
} from "react-map-gl/maplibre";
import { MAP_COLORS } from "./maplibre-setup";
import { mapBounds, type PinCollection, type PinProperties } from "@/lib/geo/map";

export interface MapCanvasProps {
  pins: PinCollection;
  /** ISO alpha-2 codes of countries to shade. */
  countries: string[];
  styleUrl: string;
}

const COLORS = MAP_COLORS;

const WORLD_VIEW = { longitude: 10, latitude: 25, zoom: 0.8 };

function initialView(pins: PinCollection, countries: string[]) {
  const bounds = mapBounds(pins, countries);
  if (!bounds) return WORLD_VIEW;
  return { bounds, fitBoundsOptions: { padding: 40, maxZoom: 5 } };
}

interface PopupState {
  longitude: number;
  latitude: number;
  items: PinProperties[];
}

function toPinProperties(properties: Record<string, unknown>): PinProperties | null {
  const { bookId, placeId, title, placeName } = properties;
  if (
    typeof bookId !== "string" ||
    typeof placeId !== "string" ||
    typeof title !== "string" ||
    typeof placeName !== "string"
  ) {
    return null;
  }
  return { bookId, placeId, title, placeName };
}

/**
 * MapLibre map: shaded countries, clustered pins (click a cluster to zoom in), all pins
 * of a book highlighted together on hover, and a popup listing the books at a pin.
 * Loaded client-side only (see MapView).
 */
export default function MapCanvas({ pins, countries, styleUrl }: MapCanvasProps) {
  const mapRef = useRef<MapRef>(null);
  const [hoveredBook, setHoveredBook] = useState<string | null>(null);
  const [popup, setPopup] = useState<PopupState | null>(null);
  const [cursor, setCursor] = useState<string>("");
  // Only the first render's view is used; later data changes keep the user's camera.
  const [view] = useState(() => initialView(pins, countries));
  const countryFilter = useMemo<FilterSpecification>(
    () => ["in", ["get", "iso"], ["literal", countries]],
    [countries],
  );

  function onMouseMove(event: MapLayerMouseEvent) {
    const feature = event.features?.[0];
    setCursor(feature ? "pointer" : "");
    const bookId =
      feature?.layer.id === "pins" && typeof feature.properties.bookId === "string"
        ? feature.properties.bookId
        : null;
    setHoveredBook(bookId);
  }

  async function onClick(event: MapLayerMouseEvent) {
    const feature = event.features?.[0];
    if (!feature) {
      setPopup(null);
      return;
    }
    if (feature.layer.id === "clusters") {
      const source = mapRef.current?.getSource<GeoJSONSource>("pins");
      const clusterId = feature.properties.cluster_id;
      if (!source || typeof clusterId !== "number" || feature.geometry.type !== "Point") return;
      const zoom = await source.getClusterExpansionZoom(clusterId);
      const [longitude, latitude] = feature.geometry.coordinates as [number, number];
      mapRef.current?.easeTo({ center: [longitude, latitude], zoom });
      return;
    }
    // Several books can share a place: list every pin under the cursor.
    const items = (event.features ?? [])
      .filter((f) => f.layer.id === "pins")
      .map((f) => toPinProperties(f.properties))
      .filter((item): item is PinProperties => item !== null);
    if (items.length && feature.geometry.type === "Point") {
      const [longitude, latitude] = feature.geometry.coordinates as [number, number];
      setPopup({ longitude, latitude, items });
    }
  }

  return (
    <Map
      ref={mapRef}
      initialViewState={view}
      mapStyle={styleUrl}
      style={{ width: "100%", height: "100%" }}
      interactiveLayerIds={["clusters", "pins"]}
      cursor={cursor}
      onMouseMove={onMouseMove}
      onMouseLeave={() => {
        setCursor("");
        setHoveredBook(null);
      }}
      onClick={onClick}
      attributionControl={{ compact: true }}
      dragRotate={false}
      touchPitch={false}
    >
      <NavigationControl position="top-right" showCompass={false} />

      <Source id="countries" type="geojson" data="/geo/countries.geojson">
        <Layer
          id="countries-fill"
          type="fill"
          filter={countryFilter}
          paint={{ "fill-color": COLORS.country, "fill-opacity": 0.3 }}
        />
        <Layer
          id="countries-line"
          type="line"
          filter={countryFilter}
          paint={{ "line-color": COLORS.country, "line-width": 1 }}
        />
      </Source>

      <Source id="pins" type="geojson" data={pins} cluster clusterMaxZoom={12} clusterRadius={40}>
        <Layer
          id="clusters"
          type="circle"
          filter={["has", "point_count"]}
          paint={{
            "circle-color": COLORS.cluster,
            "circle-opacity": 0.85,
            "circle-radius": ["step", ["get", "point_count"], 14, 10, 18, 50, 24],
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 2,
          }}
        />
        <Layer
          id="cluster-count"
          type="symbol"
          filter={["has", "point_count"]}
          layout={{
            "text-field": ["get", "point_count_abbreviated"],
            "text-font": ["Noto Sans Regular"],
            "text-size": 12,
            "text-allow-overlap": true,
          }}
          paint={{ "text-color": "#ffffff" }}
        />
        <Layer
          id="pins"
          type="circle"
          filter={["!", ["has", "point_count"]]}
          paint={{
            "circle-color": COLORS.pin,
            "circle-radius": 7,
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 2,
          }}
        />
        <Layer
          id="pins-highlight"
          type="circle"
          filter={[
            "all",
            ["!", ["has", "point_count"]],
            ["==", ["get", "bookId"], hoveredBook ?? ""],
          ]}
          paint={{
            "circle-color": COLORS.highlight,
            "circle-radius": 9,
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 2,
          }}
        />
      </Source>

      {popup ? (
        <Popup
          longitude={popup.longitude}
          latitude={popup.latitude}
          onClose={() => setPopup(null)}
          closeOnClick={false}
          maxWidth="260px"
        >
          <ul className="space-y-1 pr-4 text-sm text-neutral-900">
            {popup.items.map((item) => (
              <li key={`${item.bookId}-${item.placeId}`}>
                <span className="font-medium">{item.title}</span>
                <span className="block text-xs text-neutral-600">{item.placeName}</span>
              </li>
            ))}
          </ul>
        </Popup>
      ) : null}
    </Map>
  );
}
