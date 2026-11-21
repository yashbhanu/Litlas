import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { FetchFn } from "@/lib/external/http";

const FIXTURES = join(process.cwd(), "tests/fixtures");

export function loadFixture(path: string): unknown {
  return JSON.parse(readFileSync(join(FIXTURES, path), "utf8"));
}

export interface RecordedCall {
  url: string;
  headers: Record<string, string>;
}

/**
 * A fake fetch that serves recorded fixture files. `routes` maps a predicate on the URL
 * to a fixture path (or a status code for error responses). Unmatched URLs fail the test.
 */
export function fixtureFetch(routes: [match: (url: URL) => boolean, fixture: string | number][]) {
  const calls: RecordedCall[] = [];
  const fetchFn: FetchFn = async (input, init) => {
    const url = new URL(String(input));
    calls.push({ url: url.toString(), headers: Object.fromEntries(new Headers(init?.headers)) });
    const route = routes.find(([match]) => match(url));
    if (!route) throw new Error(`No fixture for ${url}`);
    const [, fixture] = route;
    if (typeof fixture === "number") return new Response("error", { status: fixture });
    return Response.json(loadFixture(fixture));
  };
  return { fetch: fetchFn, calls };
}
