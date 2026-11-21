/**
 * Make a user a moderator (or remove it). is_admin can only be changed with the
 * service role, never by clients.
 *
 *   pnpm admin:grant <username>            # local DB (.env.local)
 *   pnpm admin:grant <username> --revoke
 *   pnpm admin:grant <username> --env .env.production.local --yes
 */
import { existsSync } from "node:fs";
import { parseArgs } from "node:util";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    revoke: { type: "boolean", default: false },
    env: { type: "string", default: ".env.local" },
    yes: { type: "boolean", default: false },
  },
});

const username = positionals[0]?.toLowerCase();
if (!username) {
  console.error("Usage: pnpm admin:grant <username> [--revoke] [--env <file>] [--yes]");
  process.exit(1);
}
if (existsSync(values.env)) process.loadEnvFile(values.env);
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key)
  throw new Error(
    `NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (${values.env})`,
  );
const host = new URL(url).hostname;
if (host !== "127.0.0.1" && host !== "localhost" && !values.yes) {
  throw new Error(`Refusing to change ${host} without --yes`);
}

const admin = createClient<Database>(url, key, { auth: { persistSession: false } });
const { data, error } = await admin
  .from("profiles")
  .update({ is_admin: !values.revoke })
  .eq("username", username)
  .select("username, is_admin");
if (error) throw error;
if (data.length === 0) {
  console.error(`No profile with username "${username}" on ${host}`);
  process.exit(1);
}
console.log(`@${data[0]!.username} on ${host}: is_admin = ${data[0]!.is_admin}`);
