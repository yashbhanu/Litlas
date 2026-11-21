import type { z } from "zod";

export type ApiErrorCode =
  | "bad_request"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "profile_required"
  | "upstream_error"
  | "internal_error";

export interface ApiErrorBody {
  error: { code: ApiErrorCode; message: string };
}

const STATUS: Record<ApiErrorCode, number> = {
  bad_request: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  profile_required: 403,
  upstream_error: 502,
  internal_error: 500,
};

/** Typed JSON error response: `{ error: { code, message } }`. */
export function apiError(code: ApiErrorCode, message: string, status = STATUS[code]): Response {
  return Response.json({ error: { code, message } } satisfies ApiErrorBody, { status });
}

/** Turn a Zod failure into a readable 400. */
export function validationError(error: z.ZodError): Response {
  const issue = error.issues[0];
  const path = issue?.path.length ? `${issue.path.join(".")}: ` : "";
  return apiError("bad_request", `${path}${issue?.message ?? "Invalid input"}`);
}

/** Parse and validate a JSON request body. */
export async function parseJsonBody<S extends z.ZodType>(
  request: Request,
  schema: S,
): Promise<{ data: z.infer<S>; response?: never } | { data?: never; response: Response }> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { response: apiError("bad_request", "Request body must be valid JSON") };
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return { response: validationError(parsed.error) };
  return { data: parsed.data };
}

/** Postgres error codes we map to API errors. */
export const PG = {
  uniqueViolation: "23505",
  foreignKeyViolation: "23503",
} as const;

export function isPostgrestError(error: unknown): error is { code: string; message: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code: unknown }).code === "string"
  );
}

/** CDN caching for public, rarely-changing responses (explore, place/country lists). */
export const PUBLIC_CACHE = "public, s-maxage=300, stale-while-revalidate=3600";
