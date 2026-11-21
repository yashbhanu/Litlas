import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { RATE_LIMITS, type RateLimitedAction } from "@/lib/locations/constants";
import type { Database } from "./database.types";

/**
 * Count one use of `action` for the signed-in user today and say whether they're still
 * within the daily limit (Postgres counter table `rate_limits`). Call with the user client.
 */
export async function consumeRateLimit(
  supabase: SupabaseClient<Database>,
  action: RateLimitedAction,
): Promise<boolean> {
  const { data, error } = await supabase.rpc("consume_rate_limit", {
    p_action: action,
    p_max: RATE_LIMITS[action],
  });
  if (error) throw error;
  return data;
}
