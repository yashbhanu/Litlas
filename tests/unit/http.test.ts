import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { ExternalApiError, fetchJson, type FetchFn } from "@/lib/external/http";

const schema = z.object({ ok: z.boolean() });

function sequence(...responses: (() => Response)[]) {
  const fn = vi.fn<FetchFn>();
  for (const make of responses) fn.mockImplementationOnce(async () => make());
  return fn;
}

const opts = (fetch: FetchFn, sleep = vi.fn(async () => {})) => ({
  service: "test",
  userAgent: "UA",
  fetch,
  sleep,
});

describe("fetchJson", () => {
  it("retries 429 and 5xx with exponential backoff", async () => {
    const fetch = sequence(
      () => new Response("", { status: 429 }),
      () => new Response("", { status: 502 }),
      () => Response.json({ ok: true }),
    );
    const sleep = vi.fn(async () => {});

    await expect(fetchJson("https://x.test", schema, opts(fetch, sleep))).resolves.toEqual({
      ok: true,
    });
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls).toEqual([[500], [1000]]);
  });

  it("honors Retry-After instead of the backoff delay", async () => {
    const fetch = sequence(
      () => new Response("", { status: 429, headers: { "Retry-After": "3" } }),
      () => Response.json({ ok: true }),
    );
    const sleep = vi.fn(async () => {});
    await fetchJson("https://x.test", schema, opts(fetch, sleep));
    expect(sleep.mock.calls).toEqual([[3000]]);
  });

  it("does not retry other 4xx errors", async () => {
    const fetch = sequence(() => new Response("", { status: 400 }));
    await expect(fetchJson("https://x.test", schema, opts(fetch))).rejects.toMatchObject({
      status: 400,
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("returns null on 404", async () => {
    const fetch = sequence(() => new Response("", { status: 404 }));
    await expect(fetchJson("https://x.test", schema, opts(fetch))).resolves.toBeNull();
  });

  it("rejects responses that don't match the schema", async () => {
    const fetch = sequence(() => Response.json({ ok: "yes" }));
    await expect(fetchJson("https://x.test", schema, opts(fetch))).rejects.toBeInstanceOf(
      ExternalApiError,
    );
  });

  it("retries network errors, then gives up", async () => {
    const fetch = vi.fn<FetchFn>(async () => {
      throw new TypeError("fetch failed");
    });
    await expect(fetchJson("https://x.test", schema, opts(fetch))).rejects.toThrow(/fetch failed/);
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("sends User-Agent and Accept headers", async () => {
    const fetch = sequence(() => Response.json({ ok: true }));
    await fetchJson("https://x.test", schema, { ...opts(fetch), accept: "application/x" });
    const headers = new Headers(fetch.mock.calls[0]![1]?.headers);
    expect(headers.get("user-agent")).toBe("UA");
    expect(headers.get("accept")).toBe("application/x");
  });
});
