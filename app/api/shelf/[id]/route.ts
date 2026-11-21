import type { NextRequest } from "next/server";
import { apiError, validationError } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/db/server";
import { deleteShelfEntry } from "@/lib/db/shelf";
import { shelfEntryIdSchema } from "@/lib/validation/shelf";

/** DELETE /api/shelf/[id] — remove one of the signed-in user's shelf entries. */
export async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/shelf/[id]">) {
  const user = await getSessionUser();
  if (!user) return apiError("unauthorized", "Sign in to manage your shelf.");

  const parsed = shelfEntryIdSchema.safeParse((await ctx.params).id);
  if (!parsed.success) return validationError(parsed.error);

  const supabase = await createSupabaseServerClient();
  // RLS only lets owners delete, so "not deleted" means missing or not yours.
  const deleted = await deleteShelfEntry(supabase, parsed.data);
  if (!deleted) return apiError("not_found", "Shelf entry not found.");

  return new Response(null, { status: 204 });
}
