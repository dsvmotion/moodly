import { defineConfig, devices } from "@playwright/test";

// E2E contra Supabase local + seed (pnpm db:start && pnpm db:seed) y la app
// compilada (pnpm --filter @repo/web build). Ver AGENTS.md → Comandos.
const baseURL = "http://127.0.0.1:3000";

// URL y clave publicable de Supabase (las mismas que usa la app) para los
// tests que hablan directamente con la API de Auth, como el de registro.
try {
  process.loadEnvFile(".env.local");
} catch {
  // Sin .env.local: los tests que lo necesitan fallan con un mensaje claro.
}

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
    // Un Chromium ya instalado, si la versión de Playwright espera otra build
    // (p. ej. en entornos sin descarga de navegadores): CHROMIUM_PATH=/ruta/al/chrome.
    ...(process.env["CHROMIUM_PATH"] ? { launchOptions: { executablePath: process.env["CHROMIUM_PATH"] } } : {}),
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "pnpm start",
    url: `${baseURL}/login`,
    reuseExistingServer: !process.env["CI"],
    timeout: 120_000,
  },
});
