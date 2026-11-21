import { z } from "zod";
import { PLACE_SEARCH_MIN_LENGTH } from "@/lib/locations/constants";

const name = z.string().trim().min(1, "Name is required").max(120);
const countryCode = z
  .string()
  .regex(/^[A-Za-z]{2}$/, "Expected a two-letter country code")
  .transform((code) => code.toUpperCase());
const lng = z.number().min(-180).max(180);
const lat = z.number().min(-90).max(90);

/**
 * Body of POST /api/books/[id]/locations. A real place comes from the PlacePicker
 * (Photon result + chosen precision); a fictional place is just a name.
 */
export const suggestLocationSchema = z.discriminatedUnion("precision", [
  z.object({
    precision: z.enum(["city", "region"]),
    name,
    osmId: z.string().regex(/^[NWR]\d{1,15}$/, "Invalid OpenStreetMap id"),
    countryCode: countryCode.nullish(),
    lng,
    lat,
  }),
  z.object({ precision: z.literal("country"), name, countryCode }),
  z.object({ precision: z.literal("fictional"), name }),
]);
export type SuggestLocationInput = z.input<typeof suggestLocationSchema>;
export type SuggestLocation = z.output<typeof suggestLocationSchema>;

export const placeSearchSchema = z.object({
  q: z
    .string()
    .trim()
    .min(PLACE_SEARCH_MIN_LENGTH, `Type at least ${PLACE_SEARCH_MIN_LENGTH} characters`)
    .max(100),
});

/** Body of POST /api/admin/locations/[id] ([id] is a book_places id). */
export const moderateLocationSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve") }),
  z.object({ action: z.literal("reject") }),
  /** Merge the suggestion's place into an existing place (duplicates). */
  z.object({ action: z.literal("merge"), intoPlaceId: z.uuid() }),
]);
export type ModerateLocationInput = z.input<typeof moderateLocationSchema>;
