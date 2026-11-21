import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

/** Integration tests against the local Supabase stack (`pnpm db:start` first). */
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    // .env, .env.local, .env.development(.local): local Supabase URL and keys.
    env: loadEnv("development", process.cwd(), ""),
    testTimeout: 20_000,
    hookTimeout: 30_000,
    // Tests share one database; run files one at a time.
    fileParallelism: false,
    // Server modules (e.g. lib/db/settings.ts) import `server-only`; stub it as unit tests do.
    alias: {
      "server-only": fileURLToPath(new URL("./tests/unit/stubs/server-only.ts", import.meta.url)),
    },
  },
});
