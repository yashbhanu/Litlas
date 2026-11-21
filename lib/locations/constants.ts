/** Votes (including the suggester's own) that approve a pending location. Mirrors the
 * SQL function approval_threshold(); an integration test checks they match. */
export const APPROVAL_THRESHOLD = 3;

/** Per-user daily limits on write routes (Postgres counter table, rate_limits). */
export const RATE_LIMITS = {
  suggest_location: 30,
  vote_location: 100,
  shelf_write: 300,
} as const;
export type RateLimitedAction = keyof typeof RATE_LIMITS;

/** Photon autocomplete: debounce and minimum query length. */
export const PLACE_SEARCH_DEBOUNCE_MS = 300;
export const PLACE_SEARCH_MIN_LENGTH = 3;
