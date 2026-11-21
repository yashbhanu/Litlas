import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getServerEnv } from "@/lib/env.server";
import type { Database } from "./database.types";

/**
 * Service-role client: bypasses RLS. Server code only, and only for writes the spec
 * reserves for the server (books, places, admin actions). Never use it to read data
 * on behalf of a user.
 */
export function createSupabaseAdminClient() {
  const env = getServerEnv();
  return createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
