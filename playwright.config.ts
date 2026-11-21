import { defineConfig, devices } from "@playwright/test";
import { loadEnv } from "vite";

// Make .env.local (local Supabase keys) available to tests, e.g. for DB assertions.
Object.assign(process.env, { ...loadEnv("development", process.cwd(), ""), ...process.env });

const PORT = Number(process.env.PORT ?? 3000);
// localhost (not 127.0.0.1) to match the Supabase auth redirect allow-list and cookies.
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: { baseURL, trace: "on-first-retry" },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 5"], viewport: { width: 375, height: 812 } } },
  ],
  webServer: {
    command: `pnpm dev --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
