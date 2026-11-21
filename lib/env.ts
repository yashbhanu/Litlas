import { publicEnvSchema, type PublicEnv } from "@/lib/validation/env";

let cached: PublicEnv | undefined;

/**
 * Validated public env. Each variable is referenced literally so Next.js can inline it
 * into client bundles. Parsed lazily so builds without env (e.g. CI lint) don't fail.
 */
export function getPublicEnv(): PublicEnv {
  cached ??= publicEnvSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_MAP_STYLE_URL: process.env.NEXT_PUBLIC_MAP_STYLE_URL,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  });
  return cached;
}
