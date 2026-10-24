import { defineConfig } from "vitest/config";

// Tests de integración contra Supabase local levantado y con el seed aplicado
// (`pnpm db:seed`, que da login al rol dbos_worker). No entran en `pnpm test`;
// el CI los corre en el job de e2e.
export default defineConfig({
  test: {
    include: ["src/**/*.integration.ts"],
    // Arranca y mata procesos del worker de verdad.
    testTimeout: 60_000,
    // Un archivo cada vez: todos los workers publican el mismo outbox (ADR 0009)
    // y un worker de otro test, con otros consumidores, se llevaría los eventos.
    fileParallelism: false,
  },
});
