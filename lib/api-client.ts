import type { ApiErrorBody, ApiErrorCode } from "@/lib/api";

/** Error thrown by client-side API calls, carrying the server's typed error code. */
export class ApiRequestError extends Error {
  constructor(
    readonly code: ApiErrorCode | "network_error",
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  return (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof (value as ApiErrorBody).error?.message === "string"
  );
}

/** fetch() our own JSON API; throws ApiRequestError on non-2xx responses. */
export async function apiFetch<T>(input: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(input, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch {
    throw new ApiRequestError("network_error", "Network error. Check your connection.", 0);
  }

  const body: unknown = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    if (isApiErrorBody(body)) {
      throw new ApiRequestError(body.error.code, body.error.message, response.status);
    }
    throw new ApiRequestError("internal_error", "Something went wrong.", response.status);
  }
  return body as T;
}
