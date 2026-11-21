import type { NextRequest } from "next/server";
import { PUBLIC_CACHE, validationError } from "@/lib/api";
import { getBooksInCountry } from "@/lib/db/public";
import { countryCodeSchema, pageSchema } from "@/lib/validation/explore";

/** GET /api/countries/[code]/books?page= — books with a real setting in a country. */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/countries/[code]/books">) {
  const code = countryCodeSchema.safeParse((await ctx.params).code);
  if (!code.success) return validationError(code.error);
  const page = pageSchema.safeParse(request.nextUrl.searchParams.get("page") ?? undefined);
  if (!page.success) return validationError(page.error);

  const books = await getBooksInCountry(code.data, page.data);
  return Response.json(books, { headers: { "Cache-Control": PUBLIC_CACHE } });
}
