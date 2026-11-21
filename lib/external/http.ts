import type { z } from "zod";

export type FetchFn = typeof fetch;

export class ExternalApiError extends Error {
  constructor(
    readonly service: string,
    readonly status: number | null,
    message: string,
  ) {
    super(`[${service}] ${message}`);
    this.name = "ExternalApiError";
  }
}

export interface FetchJsonOptions {
  service: string;
  userAgent: string;
  fetch?: FetchFn;
  accept?: string;
  /** Retries after the first attempt, on 429/5xx/network errors. */
  retries?: number;
  baseDelayMs?: number;
  timeoutMs?: number;
  /** Injected for tests so backoff doesn't actually wait. */
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function isRetryable(status: number) {
  return status === 429 || status >= 500;
}

function retryAfterMs(response: Response): number | null {
  const header = response.headers.get("retry-after");
  if (!header) return null;
  const seconds = Number(header);
  return Number.isFinite(seconds) ? Math.min(seconds * 1000, 30_000) : null;
}

/**
 * GET a JSON resource from an external API: sends our User-Agent, retries with
 * exponential backoff on 429/5xx, and validates the body with a Zod schema.
 * Returns null on 404.
 */
export async function fetchJson<S extends z.ZodType>(
  url: string,
  schema: S,
  options: FetchJsonOptions,
): Promise<z.infer<S> | null> {
  const {
    service,
    userAgent,
    fetch: fetchFn = fetch,
    accept = "application/json",
    retries = 2,
    baseDelayMs = 500,
    timeoutMs = 10_000,
    sleep = defaultSleep,
  } = options;

  let lastError: ExternalApiError | null = null;
  let serverDelayMs: number | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await sleep(serverDelayMs ?? baseDelayMs * 2 ** (attempt - 1));
    serverDelayMs = null;

    let response: Response;
    try {
      response = await fetchFn(url, {
        headers: { "User-Agent": userAgent, Accept: accept },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      lastError = new ExternalApiError(service, null, `request failed: ${message}`);
      continue;
    }

    if (response.status === 404) return null;

    if (!response.ok) {
      lastError = new ExternalApiError(service, response.status, `HTTP ${response.status}`);
      if (!isRetryable(response.status)) throw lastError;
      serverDelayMs = retryAfterMs(response);
      continue;
    }

    const body: unknown = await response.json().catch(() => {
      throw new ExternalApiError(service, response.status, "invalid JSON body");
    });
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      throw new ExternalApiError(service, response.status, `unexpected response shape`);
    }
    return parsed.data;
  }

  throw lastError ?? new ExternalApiError(service, null, "request failed");
}
