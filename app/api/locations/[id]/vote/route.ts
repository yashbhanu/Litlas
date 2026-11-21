import type { NextRequest } from "next/server";
import { apiError, validationError } from "@/lib/api";
import { requireProfile } from "@/lib/api-auth";
import { voteForLocation, withdrawVote } from "@/lib/db/locations";
import { consumeRateLimit } from "@/lib/db/rate-limit";
import { revalidateBookPlaces } from "@/lib/db/revalidate";
import { createSupabaseServerClient } from "@/lib/db/server";
import { RATE_LIMITS } from "@/lib/locations/constants";
import { locationErrorResponse } from "@/lib/locations/errors";
import type { VoteResponse } from "@/lib/locations/types";
import { uuidSchema } from "@/lib/validation/explore";

/**
 * POST /api/locations/[id]/vote — confirm someone else's pending suggestion. At the
 * approval threshold it becomes approved (Postgres trigger). 100 votes per day.
 */
export async function POST(_request: NextRequest, ctx: RouteContext<"/api/locations/[id]/vote">) {
  const auth = await requireProfile("confirm locations");
  if (auth.response) return auth.response;
  const id = uuidSchema.safeParse((await ctx.params).id);
  if (!id.success) return validationError(id.error);

  const supabase = await createSupabaseServerClient();
  if (!(await consumeRateLimit(supabase, "vote_location"))) {
    return apiError(
      "rate_limited",
      `You can confirm up to ${RATE_LIMITS.vote_location} locations a day. Try again tomorrow.`,
    );
  }

  let result;
  try {
    result = await voteForLocation(supabase, id.data, auth.profile.id);
  } catch (error) {
    return locationErrorResponse(error);
  }
  if (result.status === "approved") {
    const { data } = await supabase
      .from("book_places")
      .select("book_id")
      .eq("id", id.data)
      .single();
    if (data) revalidateBookPlaces(data.book_id);
  }
  return Response.json(result satisfies VoteResponse);
}

/** DELETE /api/locations/[id]/vote — withdraw your vote while the suggestion is pending. */
export async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/locations/[id]/vote">) {
  const auth = await requireProfile("change your vote");
  if (auth.response) return auth.response;
  const id = uuidSchema.safeParse((await ctx.params).id);
  if (!id.success) return validationError(id.error);

  const removed = await withdrawVote(await createSupabaseServerClient(), id.data, auth.profile.id);
  if (!removed) return apiError("not_found", "You haven't confirmed this pending suggestion.");
  return new Response(null, { status: 204 });
}
