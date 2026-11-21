import { apiError } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { loadShelfMap } from "@/lib/db/map";
import { createSupabaseServerClient } from "@/lib/db/server";

/**
 * GET /api/me/map — the signed-in user's map: GeoJSON pins, covered country codes,
 * stats, and the list view (books by country, fictional settings, unplaced books).
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return apiError("unauthorized", "Sign in to see your map.");

  const { map } = await loadShelfMap(await createSupabaseServerClient(), user.id);
  return Response.json(map);
}
