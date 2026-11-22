import { z } from "zod";

/** Usernames that would collide with routes or be confusing. */
export const RESERVED_USERNAMES = new Set([
  "admin",
  "api",
  "auth",
  "explore",
  "login",
  "logout",
  "me",
  "moderate",
  "settings",
  "signup",
  "support",
  "root",
]);

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{3,20}$/, "Use 3–20 characters: lowercase letters, numbers or underscores")
  .refine((value) => !RESERVED_USERNAMES.has(value), "That username is reserved");

/** Body of POST /api/me/profile. */
export const createProfileSchema = z.object({
  username: usernameSchema,
  displayName: z
    .string()
    .trim()
    .max(50, "Display name is at most 50 characters")
    .transform((value) => value || null)
    .nullish(),
  isPublic: z.boolean().default(true),
});
export type CreateProfileInput = z.input<typeof createProfileSchema>;

/** Suggest a username from an email address (onboarding default). */
export function suggestUsername(email: string | null | undefined): string {
  const local = (email ?? "").split("@")[0] ?? "";
  const cleaned = local
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 20);
  if (cleaned.length < 3 || RESERVED_USERNAMES.has(cleaned)) return "";
  return cleaned;
}

/** A username in a URL (/u/[username]): same shape, case-insensitive, no reserved check. */
export const usernameParamSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{3,20}$/, "Not a valid username");

/** Body of PATCH /api/me/profile: any of username, display name, visibility. */
export const updateProfileSchema = z
  .object({
    username: usernameSchema.optional(),
    displayName: z
      .string()
      .trim()
      .max(50, "Display name is at most 50 characters")
      .transform((value) => value || null)
      .nullish(),
    isPublic: z.boolean().optional(),
  })
  .refine((input) => Object.values(input).some((value) => value !== undefined), {
    message: "Nothing to update",
  });
export type UpdateProfileInput = z.input<typeof updateProfileSchema>;

/** Body of DELETE /api/me: retype your username to confirm. */
export const deleteAccountSchema = z.object({ confirmUsername: z.string().trim().toLowerCase() });
