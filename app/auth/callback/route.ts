import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/db/server";
import { safeNextPath } from "@/lib/validation/auth";

const otpTypeSchema = z.enum([
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
]) satisfies z.ZodType<EmailOtpType>;

/**
 * GET /auth/callback — finishes magic-link and OAuth sign-in (PKCE code exchange, or a
 * token_hash from a custom email template), then routes to onboarding or `next`.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const next = safeNextPath(searchParams.get("next"));
  const fail = (reason: string) =>
    NextResponse.redirect(new URL(`/login?error=${reason}`, request.url));

  if (searchParams.get("error")) return fail("provider");

  const supabase = await createSupabaseServerClient();
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const otpType = otpTypeSchema.safeParse(searchParams.get("type"));

  let userId: string | undefined;
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return fail("link");
    userId = data.user?.id;
  } else if (tokenHash && otpType.success) {
    const { data, error } = await supabase.auth.verifyOtp({
      type: otpType.data,
      token_hash: tokenHash,
    });
    if (error) return fail("link");
    userId = data.user?.id;
  }
  if (!userId) return fail("link");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  const destination = profile ? next : `/onboarding?next=${encodeURIComponent(next)}`;
  return NextResponse.redirect(new URL(destination, request.url));
}
