import { apiError, isPostgrestError, parseJsonBody, PG } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/db/server";
import { createProfileSchema } from "@/lib/validation/profile";

/** POST /api/me/profile — create the signed-in user's profile (username onboarding). */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return apiError("unauthorized", "Sign in first.");

  const body = await parseJsonBody(request, createProfileSchema);
  if (body.response) return body.response;
  const input = body.data;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("profiles")
    .insert({
      id: user.id,
      username: input.username,
      display_name: input.displayName ?? null,
      is_public: input.isPublic,
    })
    .select("id, username, display_name, is_public")
    .single();

  if (error) {
    if (isPostgrestError(error) && error.code === PG.uniqueViolation) {
      return error.message.includes("profiles_pkey")
        ? apiError("conflict", "You already have a profile.")
        : apiError("conflict", "That username is taken. Try another.");
    }
    throw error;
  }

  return Response.json(
    {
      profile: {
        id: data.id,
        username: data.username,
        displayName: data.display_name,
        isPublic: data.is_public,
      },
    },
    { status: 201 },
  );
}
