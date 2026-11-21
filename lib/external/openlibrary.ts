import "server-only";

import { z } from "zod";
import type { BookSearchResult } from "@/lib/validation/books";
import { ExternalApiError, fetchJson, type FetchFn } from "./http";

const BASE_URL = "https://openlibrary.org";
const SEARCH_FIELDS = "key,title,author_name,first_publish_year,cover_i";
const MAX_REDIRECTS = 3;
const MAX_DESCRIPTION_LENGTH = 2000;
const SERVICE = "openlibrary";

// ---------------------------------------------------------------------------
// Response schemas (only the fields we use; everything else is ignored)
// ---------------------------------------------------------------------------

const searchDocSchema = z.object({
  key: z.string().regex(/^\/works\/OL\d+W$/),
  title: z.string().min(1),
  author_name: z.array(z.string()).optional(),
  first_publish_year: z.number().int().optional(),
  cover_i: z.number().int().optional(),
});

/** Docs are validated one by one so a single odd record doesn't fail the whole search. */
const searchResponseSchema = z.object({ docs: z.array(z.unknown()) });

const textValueSchema = z.union([z.string(), z.object({ value: z.string() })]);

const workResponseSchema = z.union([
  z.object({
    type: z.object({ key: z.literal("/type/redirect") }),
    location: z.string().regex(/^\/works\/OL\d+W$/),
  }),
  z.object({
    type: z.object({ key: z.literal("/type/work") }).optional(),
    key: z.string().regex(/^\/works\/OL\d+W$/),
    title: z.string().min(1),
    description: textValueSchema.optional(),
    covers: z.array(z.number().int()).optional(),
  }),
]);

// ---------------------------------------------------------------------------
// Normalization helpers (pure, unit tested)
// ---------------------------------------------------------------------------

export function workIdFromKey(key: string): string {
  return key.replace(/^\/works\//, "");
}

export function normalizeSearchDocs(docs: unknown[]): BookSearchResult[] {
  const results: BookSearchResult[] = [];
  const seen = new Set<string>();
  for (const doc of docs) {
    const parsed = searchDocSchema.safeParse(doc);
    if (!parsed.success) continue;
    const olWorkId = workIdFromKey(parsed.data.key);
    if (seen.has(olWorkId)) continue;
    seen.add(olWorkId);
    results.push({
      olWorkId,
      title: parsed.data.title,
      authors: [...new Set(parsed.data.author_name ?? [])],
      firstPublishYear: parsed.data.first_publish_year ?? null,
      coverId: parsed.data.cover_i && parsed.data.cover_i > 0 ? parsed.data.cover_i : null,
    });
  }
  return results;
}

/**
 * Open Library descriptions are a string or { type, value }, often with a trailing
 * "----------" section of related links and markdown-style links. Keep the prose.
 */
export function cleanDescription(
  description: z.infer<typeof textValueSchema> | undefined,
): string | null {
  if (!description) return null;
  let text = typeof description === "string" ? description : description.value;
  text = text.split(/\r?\n-{5,}/)[0] ?? text;
  text = text
    .replace(/\[([^\]]+)\]\[\d+\]/g, "$1") // [text][1] reference links
    .replace(/\[([^\]]+)\]\((?:https?:\/\/)[^)]+\)/g, "$1") // [text](url)
    .replace(/^\s*\[\d+\]:\s*\S+\s*$/gm, "") // [1]: url definitions
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!text) return null;
  if (text.length > MAX_DESCRIPTION_LENGTH) {
    text = `${text.slice(0, MAX_DESCRIPTION_LENGTH).replace(/\s+\S*$/, "")}…`;
  }
  return text;
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export interface BookMetadata extends BookSearchResult {
  description: string | null;
}

export interface OpenLibraryClientOptions {
  userAgent: string;
  fetch?: FetchFn;
  sleep?: (ms: number) => Promise<void>;
}

export function createOpenLibraryClient(options: OpenLibraryClientOptions) {
  const http = { service: SERVICE, ...options };

  async function search(query: string, limit = 10): Promise<BookSearchResult[]> {
    const url = new URL("/search.json", BASE_URL);
    url.searchParams.set("q", query);
    url.searchParams.set("fields", SEARCH_FIELDS);
    url.searchParams.set("limit", String(limit));
    const body = await fetchJson(url.toString(), searchResponseSchema, http);
    return body ? normalizeSearchDocs(body.docs) : [];
  }

  /**
   * Full metadata for one work, following Open Library redirects to the canonical id.
   * Two requests: the work JSON (title, description, covers) and a key search
   * (author names, first publish year, preferred cover) to avoid per-author lookups.
   * Returns null if the work doesn't exist.
   */
  async function getWork(olWorkId: string): Promise<BookMetadata | null> {
    let id = olWorkId;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const work = await fetchJson(`${BASE_URL}/works/${id}.json`, workResponseSchema, http);
      if (!work) return null;
      if ("location" in work) {
        id = workIdFromKey(work.location);
        continue;
      }

      const canonicalId = workIdFromKey(work.key);
      const [summary] = await search(`key:"/works/${canonicalId}"`, 1);
      const match = summary?.olWorkId === canonicalId ? summary : undefined;
      const fallbackCover = work.covers?.find((cover) => cover > 0) ?? null;

      return {
        olWorkId: canonicalId,
        title: match?.title ?? work.title,
        authors: match?.authors ?? [],
        firstPublishYear: match?.firstPublishYear ?? null,
        coverId: match?.coverId ?? fallbackCover,
        description: cleanDescription(work.description),
      };
    }
    throw new ExternalApiError(SERVICE, null, `too many redirects for ${olWorkId}`);
  }

  return { search, getWork };
}

export type OpenLibraryClient = ReturnType<typeof createOpenLibraryClient>;
