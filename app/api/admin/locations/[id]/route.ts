import type { NextRequest } from "next/server";
import { apiError, isPostgrestError, parseJsonBody, validationError } from "@/lib/api";
import { requireProfile } from "@/lib/api-auth";
import { createSupabaseAdminClient } from "@/lib/db/admin";
import { isAdmin, mergeLinkPlace, setLinkStatus } from "@/lib/db/locations";
import { revalidateBookPlaces } from "@/lib/db/revalidate";
import { locationErrorResponse } from "@/lib/locations/errors";
import { uuidSchema } from "@/lib/validation/explore";
import { moderateLocationSchema } from "@/lib/validation/locations";

/**
 * POST /api/admin/locations/[id] — moderate a book ↔ place link ([id] = book_places id):
 * `approve`, `reject`, or `merge` its place into an existing duplicate place.
 */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/admin/locations/[id]">) {
  const auth = await requireProfile("moderate");
  if (auth.response) return auth.response;
  const admin = createSupabaseAdminClient();
  // Admin checks use the service role: clients can never read is_admin.
  if (!(await isAdmin(admin, auth.profile.id))) return apiError("forbidden", "Admins only.");

  const id = uuidSchema.safeParse((await ctx.params).id);
  if (!id.success) return validationError(id.error);
  const body = await parseJsonBody(request, moderateLocationSchema);
  if (body.response) return body.response;
  const input = body.data;

  let bookId: string | null;
  try {
    bookId =
      input.action === "merge"
        ? await mergeLinkPlace(admin, id.data, input.intoPlaceId)
        : await setLinkStatus(admin, id.data, input.action === "approve" ? "approved" : "rejected");
  } catch (error) {
    if (isPostgrestError(error) && /not found/.test(error.message)) {
      return apiError("not_found", "Target place not found.");
    }
    return locationErrorResponse(error);
  }
  if (!bookId) return apiError("not_found", "Suggestion not found.");

  revalidateBookPlaces(bookId);
  return Response.json({ ok: true });
}
