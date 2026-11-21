import "server-only";

import { getServerEnv } from "@/lib/env.server";
import { createWikidataClient, type WikidataClient } from "./wikidata";

let client: WikidataClient | undefined;

/** One client per server process, so all Wikidata queries share one serial queue. */
export function getWikidata(): WikidataClient {
  client ??= createWikidataClient({ userAgent: getServerEnv().APP_USER_AGENT });
  return client;
}
