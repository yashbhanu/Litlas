import { z } from "zod";
import type { Bbox } from "@/lib/geo/bbox";

/** "minLng,minLat,maxLng,maxLat" (longitudes may exceed ±180 when the map wraps). */
export const bboxSchema = z
  .string()
  .transform((value) => value.split(",").map(Number))
  .pipe(
    z
      .tuple([
        z.number().min(-540).max(540),
        z.number().min(-90).max(90),
        z.number().min(-540).max(540),
        z.number().min(-90).max(90),
      ])
      .refine(([minLng, minLat, maxLng, maxLat]) => minLng < maxLng && minLat < maxLat, {
        message: "Expected minLng,minLat,maxLng,maxLat with min < max",
      }),
  )
  .transform((tuple): Bbox => [tuple[0], tuple[1], tuple[2], tuple[3]]);

export const exploreQuerySchema = z.object({
  bbox: bboxSchema,
  zoom: z.coerce.number().min(0).max(24).default(0),
});

export const pageSchema = z.coerce.number().int().min(1).max(10_000).default(1);

export const countryCodeSchema = z
  .string()
  .regex(/^[A-Za-z]{2}$/, "Expected a two-letter country code")
  .transform((code) => code.toUpperCase());

export const placeSearchQuerySchema = z.object({
  q: z.string().trim().min(2, "Search needs at least 2 characters").max(100),
});

export const uuidSchema = z.uuid();
