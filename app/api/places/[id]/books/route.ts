import type { NextRequest } from "next/server";
import { apiError, PUBLIC_CACHE, validationError } from "@/lib/api";
import { getBooksAtPlace, getPlace } from "@/lib/db/public";
import { pageSchema, uuidSchema } from "@/lib/validation/explore";

/** GET /api/places/[id]/books?page= — books set at a place, 20 per page. */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/places/[id]/books">) {
  const id = uuidSchema.safeParse((await ctx.params).id);
  if (!id.success) return validationError(id.error);
  const page = pageSchema.safeParse(request.nextUrl.searchParams.get("page") ?? undefined);
  if (!page.success) return validationError(page.error);

  const place = await getPlace(id.data);
  if (!place) return apiError("not_found", "Place not found.");
  const books = await getBooksAtPlace(id.data, page.data);
  return Response.json({ place, ...books }, { headers: { "Cache-Control": PUBLIC_CACHE } });
}
