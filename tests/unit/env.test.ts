import { describe, expect, it } from "vitest";
import { publicEnvSchema, serverEnvSchema } from "@/lib/validation/env";

const validPublic = {
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
  NEXT_PUBLIC_MAP_STYLE_URL: "https://tiles.openfreemap.org/styles/liberty",
  NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
};

describe("env schemas", () => {
  it("accepts a complete public env", () => {
    expect(publicEnvSchema.safeParse(validPublic).success).toBe(true);
  });

  it("rejects a malformed Supabase URL", () => {
    const result = publicEnvSchema.safeParse({ ...validPublic, NEXT_PUBLIC_SUPABASE_URL: "nope" });
    expect(result.success).toBe(false);
  });

  it("requires server secrets in the server schema", () => {
    expect(serverEnvSchema.safeParse(validPublic).success).toBe(false);
    expect(
      serverEnvSchema.safeParse({
        ...validPublic,
        SUPABASE_SERVICE_ROLE_KEY: "service-key",
        APP_USER_AGENT: "LiteraryWorldMap/0.1 (contact)",
      }).success,
    ).toBe(true);
  });
});
