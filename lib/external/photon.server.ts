import "server-only";

import { cacheLife } from "next/cache";
import { getServerEnv } from "@/lib/env.server";
import { createPhotonClient } from "./photon";

/** Place search, cached on the server for a day per normalized query. */
export async function searchPlacesCached(query: string) {
  "use cache";
  cacheLife("days");
  return createPhotonClient({ userAgent: getServerEnv().APP_USER_AGENT }).search(query);
}
