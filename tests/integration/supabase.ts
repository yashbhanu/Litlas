import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";

function env(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set. Copy .env.example to .env.local and run pnpm db:start.`);
  }
  return value;
}

const url = () => env("NEXT_PUBLIC_SUPABASE_URL");
const options = { auth: { persistSession: false, autoRefreshToken: false } };

export type Client = SupabaseClient<Database>;

/** Service-role client (bypasses RLS) for setup and cleanup only. */
export function adminClient(): Client {
  return createClient<Database>(url(), env("SUPABASE_SERVICE_ROLE_KEY"), options);
}

/** Signed-out client (the `anon` role). */
export function anonClient(): Client {
  return createClient<Database>(url(), env("NEXT_PUBLIC_SUPABASE_ANON_KEY"), options);
}

export interface TestUser {
  id: string;
  email: string;
  client: Client;
}

/** Create a confirmed auth user and return a client signed in as them. */
export async function createTestUser(admin: Client, label: string): Promise<TestUser> {
  const email = `${label}-${randomUUID()}@test.local`;
  const password = `pw-${randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;

  const client = anonClient();
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;

  return { id: data.user.id, email, client };
}

export function uniqueUsername(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 8)}`;
}
