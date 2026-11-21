import { z } from "zod";

/** Variables safe to expose to the browser (NEXT_PUBLIC_*). */
export const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_MAP_STYLE_URL: z.url(),
  NEXT_PUBLIC_SITE_URL: z.url(),
});

/** Server-only variables. Never import the server env module into client components. */
export const serverEnvSchema = publicEnvSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  APP_USER_AGENT: z.string().min(1),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;
