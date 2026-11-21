import "server-only";

import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/db/server";

export interface SessionUser {
  id: string;
  email: string | null;
}

export interface Profile {
  id: string;
  username: string;
  displayName: string | null;
  isPublic: boolean;
}

/** The signed-in user from the verified session JWT, or null. Deduped per request. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data) return null;
  const email = typeof data.claims.email === "string" ? data.claims.email : null;
  return { id: data.claims.sub, email };
});

/** A user's profile, or null if they haven't picked a username yet. Deduped per request. */
export const getProfile = cache(async (userId: string): Promise<Profile | null> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, display_name, is_public")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    username: data.username,
    displayName: data.display_name,
    isPublic: data.is_public,
  };
});
