import type { MetadataRoute } from "next";
import { listSitemapIds } from "@/lib/db/public";
import { getPublicEnv } from "@/lib/env";

/**
 * /sitemap.xml: static pages, plus every book, place and country page (about 16k URLs,
 * under the 50k-per-sitemap limit). Regenerated daily.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getPublicEnv().NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const { books, places, countries } = await listSitemapIds();
  return [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/explore`, changeFrequency: "daily", priority: 0.9 },
    ...countries.map((code) => ({
      url: `${base}/country/${code}`,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...places.map((id) => ({
      url: `${base}/place/${id}`,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    ...books.map((book) => ({
      url: `${base}/book/${book.id}`,
      lastModified: book.createdAt ?? undefined,
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
  ];
}
