import { projectLngLat } from "@/lib/geo/svg-map";
import world from "@/lib/geo/world-paths.json";

const PATHS = world.paths as Record<string, string>;

const DEFAULT_COLORS = {
  water: "#d6e2ec",
  land: "#ffffff",
  border: "#c4d0db",
  country: "#0f766e",
  pin: "#e07a1f",
};

/**
 * Static world map as inline SVG (works in next/og share images and server pages): the
 * given countries shaded, pins on top. No client JS.
 */
export function WorldMapSvg({
  countries = [],
  pins = [],
  width,
  height,
  colors = DEFAULT_COLORS,
  title,
}: {
  countries?: string[];
  pins?: [number, number][];
  width?: number;
  height?: number;
  colors?: typeof DEFAULT_COLORS;
  title?: string;
}) {
  const shaded = new Set(countries);
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${world.width} ${world.height}`}
      xmlns="http://www.w3.org/2000/svg"
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      style={width ? undefined : { width: "100%", height: "auto", display: "block" }}
    >
      <rect x="0" y="0" width={world.width} height={world.height} fill={colors.water} />
      {Object.entries(PATHS).map(([iso, d]) => (
        <path
          key={iso}
          d={d}
          fill={shaded.has(iso) ? colors.country : colors.land}
          stroke={colors.border}
          strokeWidth={0.4}
        />
      ))}
      {pins.map(([lng, lat], index) => {
        const [x, y] = projectLngLat(lng, lat);
        return (
          <circle
            key={index}
            cx={x}
            cy={y}
            r={4.5}
            fill={colors.pin}
            stroke="#ffffff"
            strokeWidth={1.5}
          />
        );
      })}
    </svg>
  );
}
