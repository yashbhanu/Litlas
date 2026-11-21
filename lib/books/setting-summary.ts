import type { BookPlace } from "@/lib/geo/map";

const MAX_PLACE_NAMES = 3;
const PRECISION_ORDER: Record<BookPlace["precision"], number> = {
  country: 0,
  region: 1,
  city: 2,
  point: 3,
  fictional: 4,
};

/** One line describing where a book is set: real places first, then fictional ones. */
export function settingSummary(places: BookPlace[]): string {
  if (places.length === 0) return "No setting yet";
  // Broadest first (countries, regions, cities), then landmarks.
  const real = places
    .filter((place) => place.precision !== "fictional")
    .sort((a, b) => PRECISION_ORDER[a.precision] - PRECISION_ORDER[b.precision])
    .map((p) => p.name);
  const fictional = places.filter((place) => place.precision === "fictional").map((p) => p.name);
  const shown = real.slice(0, MAX_PLACE_NAMES);
  const more = real.length - shown.length;
  const parts: string[] = [];
  if (shown.length) parts.push(shown.join(", ") + (more > 0 ? ` +${more} more` : ""));
  if (fictional.length) parts.push(`Fictional: ${fictional.join(", ")}`);
  return parts.join(" · ");
}
