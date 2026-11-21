import "server-only";

import { apiError } from "@/lib/api";
import { LocationActionError } from "@/lib/db/locations";

/** Map a suggestion/vote rule violation to a typed API error, or rethrow. */
export function locationErrorResponse(error: unknown): Response {
  if (!(error instanceof LocationActionError)) throw error;
  switch (error.reason) {
    case "not_found":
      return apiError("not_found", "That suggestion doesn't exist.");
    case "own_suggestion":
      return apiError("forbidden", "You can't vote on your own suggestion.");
    case "already_voted":
      return apiError("conflict", "You've already confirmed this location.");
    case "not_pending":
      return apiError("conflict", "This suggestion is no longer open for votes.");
    case "rejected":
      return apiError("conflict", "A moderator rejected this location for this book.");
  }
}
