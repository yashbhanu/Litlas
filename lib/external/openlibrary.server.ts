import "server-only";

import { cacheLife } from "next/cache";
import { getServerEnv } from "@/lib/env.server";
import { createOpenLibraryClient, type OpenLibraryClient } from "./openlibrary";

export function getOpenLibrary(): OpenLibraryClient {
  return createOpenLibraryClient({ userAgent: getServerEnv().APP_USER_AGENT });
}

/** Book search, cached on the server for a day per normalized query. Errors aren't cached. */
export async function searchBooksCached(query: string) {
  "use cache";
  cacheLife("days");
  return getOpenLibrary().search(query);
}
