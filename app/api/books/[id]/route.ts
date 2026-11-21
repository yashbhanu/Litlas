import type { NextRequest } from "next/server";
import { apiError, validationError } from "@/lib/api";
import { listPendingSuggestions } from "@/lib/db/locations";
import { getBookDetail } from "@/lib/db/public";
import { createSupabaseServerClient } from "@/lib/db/server";
import { uuidSchema } from "@/lib/validation/explore";

/**
 * GET /api/books/[id] — a book with its approved places and pending suggestions (with
 * vote counts, and whether the signed-in viewer made or confirmed each).
 */
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/books/[id]">) {
  const id = uuidSchema.safeParse((await ctx.params).id);
  if (!id.success) return validationError(id.error);
  const book = await getBookDetail(id.data);
  if (!book) return apiError("not_found", "Book not found.");
  const suggestions = await listPendingSuggestions(await createSupabaseServerClient(), id.data);
  return Response.json({ book, suggestions });
}
