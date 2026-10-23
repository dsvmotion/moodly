// Escribe apps/worker/.env.local para `pnpm --filter @repo/worker dev`, contra
// Supabase local y con el rol dbos_worker (su contraseña la pone `pnpm db:seed`).
// No imprime valores. Uso: pnpm --filter @repo/worker env:local
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { localSystemDatabaseUrl } from "../src/testing/local-system-db.ts";

const envFile = resolve(dirname(fileURLToPath(import.meta.url)), "../.env.local");

// En local hay un solo worker: un executorID fijo basta (regla 1 del ADR 0027).
writeFileSync(
  envFile,
  `WORKER_SYSTEM_DATABASE_URL=${localSystemDatabaseUrl()}\nWORKER_EXECUTOR_ID=local\nWORKER_APP_VERSION=local\nLOG_LEVEL=info\n`,
  { mode: 0o600 },
);
console.log("apps/worker/.env.local escrito (WORKER_SYSTEM_DATABASE_URL, WORKER_EXECUTOR_ID, WORKER_APP_VERSION, LOG_LEVEL)");
