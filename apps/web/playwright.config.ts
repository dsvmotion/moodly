import { defineConfig, devices } from "@playwright/test";

// E2E contra Supabase local + seed (pnpm db:start && pnpm db:seed) y la app
// compilada (pnpm --filter @repo/web build). Ver AGENTS.md → Comandos.
const baseURL = "http://127.0.0.1:3000";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.e2e.ts",
  fullyParallel: true,
  forbidOnly: Boolean(process.env["CI"]),
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "pnpm start",
    url: `${baseURL}/login`,
    reuseExistingServer: !process.env["CI"],
    timeout: 120_000,
  },
});
