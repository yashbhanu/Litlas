import "server-only";

import { apiError } from "@/lib/api";
import { getProfile, getSessionUser, type Profile } from "@/lib/auth";

/** The signed-in user's profile, or an error response (401 / profile required). */
export async function requireProfile(
  action: string,
): Promise<{ profile: Profile; response?: never } | { profile?: never; response: Response }> {
  const user = await getSessionUser();
  if (!user) return { response: apiError("unauthorized", `Sign in to ${action}.`) };
  const profile = await getProfile(user.id);
  if (!profile) return { response: apiError("profile_required", `Pick a username to ${action}.`) };
  return { profile };
}
