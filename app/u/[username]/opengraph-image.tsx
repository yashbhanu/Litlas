import { ImageResponse } from "next/og";
import { WorldMapSvg } from "@/components/og/world-map-svg";
import { loadPublicReadingMap } from "@/lib/db/public";
import { usernameParamSchema } from "@/lib/validation/profile";

export const alt = "A reader's map of the books they've read, pinned where the stories are set";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const TEAL = "#0f766e";
const INK = "#1f2937";
const MUTED = "#64748b";

/** Share image for /u/[username]: the reader's map, with their stats. */
export default async function Image({ params }: { params: Promise<{ username: string }> }) {
  const parsed = usernameParamSchema.safeParse((await params).username);
  const reader = parsed.success ? await loadPublicReadingMap(parsed.data) : null;
  const name = reader ? (reader.displayName ?? `@${reader.username}`) : null;

  const stats = reader
    ? [
        { value: reader.stats.booksRead, label: reader.stats.booksRead === 1 ? "book" : "books" },
        {
          value: reader.stats.countries,
          label: reader.stats.countries === 1 ? "country" : "countries",
        },
        {
          value: reader.stats.continents,
          label: reader.stats.continents === 1 ? "continent" : "continents",
        },
      ]
    : [];

  const title = name ? `${name}'s reading map` : "Read around the world";
  // Shrink long titles to fit the 1088 px line (~0.52 em per character).
  const titleSize = Math.max(34, Math.min(56, Math.floor(1088 / (title.length * 0.52))));

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "#f5f7f9",
        fontFamily: "sans-serif",
        padding: "40px 56px 44px",
      }}
    >
      <div style={{ display: "flex", fontSize: 26, color: TEAL, fontWeight: 600 }}>
        Literary World Map
      </div>
      <div
        style={{
          display: "flex",
          fontSize: titleSize,
          color: INK,
          fontWeight: 700,
          marginTop: 4,
          marginBottom: 22,
          overflow: "hidden",
          whiteSpace: "nowrap",
          textOverflow: "ellipsis",
        }}
      >
        {title}
      </div>
      <div
        style={{
          display: "flex",
          position: "relative",
          flex: 1,
          borderRadius: 28,
          overflow: "hidden",
          border: "2px solid #e2e8f0",
        }}
      >
        <WorldMapSvg
          width={1088}
          height={428}
          countries={reader?.countries ?? []}
          pins={reader?.pins ?? []}
        />
        {stats.length ? (
          <div style={{ display: "flex", gap: 12, position: "absolute", left: 20, bottom: 20 }}>
            {stats.map((stat) => (
              <div
                key={stat.label}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  background: "#ffffff",
                  border: "2px solid #e2e8f0",
                  borderRadius: 18,
                  padding: "10px 20px",
                  minWidth: 120,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    fontSize: 42,
                    fontWeight: 700,
                    color: stat.label.startsWith("countr") ? TEAL : INK,
                  }}
                >
                  {stat.value}
                </div>
                <div style={{ display: "flex", fontSize: 20, color: MUTED }}>{stat.label}</div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>,
    size,
  );
}
