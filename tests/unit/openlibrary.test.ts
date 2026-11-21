import { describe, expect, it } from "vitest";
import { ExternalApiError } from "@/lib/external/http";
import {
  cleanDescription,
  createOpenLibraryClient,
  normalizeSearchDocs,
} from "@/lib/external/openlibrary";
import { fixtureFetch, loadFixture } from "./helpers/fixture-fetch";

const UA = "LiteraryWorldMap/test";
const noSleep = async () => {};

const isSearch = (q: string) => (url: URL) =>
  url.pathname === "/search.json" && url.searchParams.get("q") === q;
const isWork = (id: string) => (url: URL) => url.pathname === `/works/${id}.json`;

describe("normalizeSearchDocs", () => {
  it("normalizes the recorded Ulysses search", () => {
    const { docs } = loadFixture("openlibrary/search-ulysses.json") as { docs: unknown[] };
    const results = normalizeSearchDocs(docs);

    expect(results.length).toBeGreaterThan(5);
    expect(results[0]).toEqual({
      olWorkId: "OL86318W",
      title: "Ulysses",
      authors: ["James Joyce"],
      firstPublishYear: 1914,
      coverId: 13136548,
    });
    for (const result of results) expect(result.olWorkId).toMatch(/^OL\d+W$/);
  });

  it("skips malformed docs, dedupes works and nulls missing fields", () => {
    const results = normalizeSearchDocs([
      { key: "/works/OL1W", title: "A", author_name: ["X", "X"] },
      { key: "/works/OL1W", title: "A again" },
      { key: "/books/OL2M", title: "An edition, not a work" },
      { title: "No key" },
      { key: "/works/OL3W", title: "B", cover_i: -1 },
      "garbage",
    ]);
    expect(results).toEqual([
      { olWorkId: "OL1W", title: "A", authors: ["X"], firstPublishYear: null, coverId: null },
      { olWorkId: "OL3W", title: "B", authors: [], firstPublishYear: null, coverId: null },
    ]);
  });
});

describe("cleanDescription", () => {
  it("accepts both string and { value } shapes", () => {
    expect(cleanDescription("Plain text.")).toBe("Plain text.");
    expect(cleanDescription({ value: "Typed text." })).toBe("Typed text.");
    expect(cleanDescription(undefined)).toBeNull();
    expect(cleanDescription("   ")).toBeNull();
  });

  it("drops the trailing related-links section and markdown links", () => {
    const raw =
      "A [great](https://example.com/x) novel about [Dublin][1].\r\n\r\n[1]: https://example.com\r\n\r\n----------\r\nAlso contained in:\r\n- [Something](https://openlibrary.org/works/OL1W)";
    expect(cleanDescription(raw)).toBe("A great novel about Dublin.");
  });

  it("truncates very long descriptions on a word boundary", () => {
    const text = cleanDescription("word ".repeat(1000));
    expect(text!.length).toBeLessThanOrEqual(2001);
    expect(text!.endsWith("word…")).toBe(true);
  });
});

describe("OpenLibrary client", () => {
  it("search sends the User-Agent and requests only the needed fields", async () => {
    const { fetch, calls } = fixtureFetch([
      [isSearch("ulysses"), "openlibrary/search-ulysses.json"],
    ]);
    const client = createOpenLibraryClient({ userAgent: UA, fetch, sleep: noSleep });

    const results = await client.search("ulysses");

    expect(results[0]?.title).toBe("Ulysses");
    expect(calls).toHaveLength(1);
    expect(calls[0]!.headers["user-agent"]).toBe(UA);
    const url = new URL(calls[0]!.url);
    expect(url.searchParams.get("fields")).toBe("key,title,author_name,first_publish_year,cover_i");
    expect(url.searchParams.get("limit")).toBe("10");
  });

  it("search returns [] when nothing matches", async () => {
    const { fetch } = fixtureFetch([[isSearch("zzqq"), "openlibrary/search-empty.json"]]);
    const client = createOpenLibraryClient({ userAgent: UA, fetch, sleep: noSleep });
    expect(await client.search("zzqq")).toEqual([]);
  });

  it("getWork combines work details with the key search", async () => {
    const { fetch } = fixtureFetch([
      [isWork("OL86318W"), "openlibrary/work-OL86318W.json"],
      [isSearch('key:"/works/OL86318W"'), "openlibrary/search-key-OL86318W.json"],
    ]);
    const client = createOpenLibraryClient({ userAgent: UA, fetch, sleep: noSleep });

    const work = await client.getWork("OL86318W");

    expect(work).toMatchObject({
      olWorkId: "OL86318W",
      title: "Ulysses",
      authors: ["James Joyce"],
      firstPublishYear: 1914,
      coverId: 13136548,
    });
    expect(work!.description).toMatch(/^Written over a seven-year period/);
  });

  it("getWork follows redirects to the canonical work", async () => {
    const { fetch, calls } = fixtureFetch([
      [isWork("OL45883W"), "openlibrary/work-OL45883W-redirect.json"],
      [isWork("OL45804W"), "openlibrary/work-OL45804W.json"],
      [isSearch('key:"/works/OL45804W"'), "openlibrary/search-key-OL45804W.json"],
    ]);
    const client = createOpenLibraryClient({ userAgent: UA, fetch, sleep: noSleep });

    const work = await client.getWork("OL45883W");

    expect(work).toMatchObject({
      olWorkId: "OL45804W",
      title: "Fantastic Mr Fox",
      authors: ["Roald Dahl"],
      firstPublishYear: 1970,
      coverId: 6498519,
    });
    expect(work!.description).toMatch(/^The main character of Fantastic Mr\. Fox/);
    expect(calls.map((c) => new URL(c.url).pathname)).toEqual([
      "/works/OL45883W.json",
      "/works/OL45804W.json",
      "/search.json",
    ]);
  });

  it("getWork returns null for unknown works", async () => {
    const { fetch } = fixtureFetch([[isWork("OL1W"), 404]]);
    const client = createOpenLibraryClient({ userAgent: UA, fetch, sleep: noSleep });
    expect(await client.getWork("OL1W")).toBeNull();
  });

  it("surfaces persistent upstream failures as ExternalApiError", async () => {
    const { fetch, calls } = fixtureFetch([[() => true, 503]]);
    const client = createOpenLibraryClient({ userAgent: UA, fetch, sleep: noSleep });
    await expect(client.search("ulysses")).rejects.toBeInstanceOf(ExternalApiError);
    expect(calls).toHaveLength(3); // first try + 2 retries
  });
});
