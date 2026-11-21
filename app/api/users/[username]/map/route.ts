import type { NextRequest } from "next/server";
import { apiError, validationError } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { findProfileByUsername, loadShelfMap } from "@/lib/db/map";
import { createSupabaseServerClient } from "@/lib/db/server";
import { usernameParamSchema } from "@/lib/validation/profile";

/** GET /api/users/[username]/map — a public profile's map (same shape as /api/me/map). */
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/users/[username]/map">) {
  const parsed = usernameParamSchema.safeParse((await ctx.params).username);
  if (!parsed.success) return validationError(parsed.error);

  const supabase = await createSupabaseServerClient();
  const profile = await findProfileByUsername(supabase, parsed.data);
  if (!profile) return apiError("not_found", "No reader with that username.");
  // RLS hides private shelves anyway; say so explicitly instead of returning an empty map.
  // Owners can still see their own.
  if (!profile.isPublic && (await getSessionUser())?.id !== profile.id) {
    return apiError("forbidden", "This reader's map is private.");
  }

  const { map } = await loadShelfMap(supabase, profile.id);
  return Response.json(map);
}
