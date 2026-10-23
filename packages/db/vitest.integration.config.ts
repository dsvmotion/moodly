import { defineConfig } from "vitest/config";

// Tests de integración contra Supabase local levantado y con el seed aplicado
// (`pnpm db:seed`). No entran en `pnpm test`; el CI los corre en el job de e2e.
export default defineConfig({
  test: {
    include: ["src/**/*.integration.ts"],
  },
});
