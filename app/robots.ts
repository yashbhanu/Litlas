import type { MetadataRoute } from "next";
import { getPublicEnv } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  const base = getPublicEnv().NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Personal, admin and API routes aren't useful in search results.
      disallow: ["/api/", "/me", "/add", "/onboarding", "/settings", "/moderate", "/auth/"],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
