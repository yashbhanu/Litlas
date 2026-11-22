import { apiError, parseJsonBody } from "@/lib/api";
import { getProfile, getSessionUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/db/admin";
import { createSupabaseServerClient } from "@/lib/db/server";
import { deleteAccountSchema } from "@/lib/validation/profile";

/**
 * DELETE /api/me — delete the signed-in user's account. Deleting the auth user cascades
 * to their profile, shelf entries, votes and rate-limit counters. Location suggestions
 * they made stay, without their name (created_by is set to null). Requires retyping the
 * username.
 */
export async function DELETE(request: Request) {
  const user = await getSessionUser();
  if (!user) return apiError("unauthorized", "Sign in first.");

  const body = await parseJsonBody(request, deleteAccountSchema);
  if (body.response) return body.response;

  const profile = await getProfile(user.id);
  if (profile && body.data.confirmUsername !== profile.username) {
    return apiError("bad_request", "Type your username exactly to confirm.");
  }

  const { error } = await createSupabaseAdminClient().auth.admin.deleteUser(user.id);
  if (error) throw error;

  // Clear the session cookies. The user no longer exists, so the server call may fail.
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);

  return new Response(null, { status: 204 });
}
