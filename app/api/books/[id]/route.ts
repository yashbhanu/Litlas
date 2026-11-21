import type { NextRequest } from "next/server";
import { apiError, validationError } from "@/lib/api";
import { getBookDetail } from "@/lib/db/public";
import { uuidSchema } from "@/lib/validation/explore";

/**
 * GET /api/books/[id] — a book with its approved places. (Pending suggestions are added
 * in Phase 4.)
 */
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/books/[id]">) {
  const id = uuidSchema.safeParse((await ctx.params).id);
  if (!id.success) return validationError(id.error);
  const book = await getBookDetail(id.data);
  if (!book) return apiError("not_found", "Book not found.");
  return Response.json({ book });
}
