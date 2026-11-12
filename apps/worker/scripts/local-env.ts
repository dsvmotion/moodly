// Escribe apps/worker/.env.local para `pnpm --filter @repo/worker dev`, contra
// Supabase local: el rol dbos_worker (su contraseña la pone `pnpm db:seed`) y
// la API con la clave secreta local. No imprime valores.
// Uso: pnpm --filter @repo/worker env:local
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { localSupabaseApi, localSystemDatabaseUrl } from "../src/testing/local-system-db.ts";

const envFile = resolve(dirname(fileURLToPath(import.meta.url)), "../.env.local");

const api = localSupabaseApi();
// En local hay un solo worker: un executorID fijo basta (regla 1 del ADR 0027).
writeFileSync(
  envFile,
  [
    `WORKER_SYSTEM_DATABASE_URL=${localSystemDatabaseUrl()}`,
    "WORKER_EXECUTOR_ID=local",
    "WORKER_APP_VERSION=local",
    "LOG_LEVEL=info",
    `SUPABASE_URL=${api.url}`,
    `SUPABASE_SECRET_KEY=${api.secretKey}`,
    // Los enlaces de los avisos por email, a la web local. Sin RESEND_API_KEY no se envían.
    "WEB_APP_URL=http://127.0.0.1:3000",
    "",
  ].join("\n"),
  { mode: 0o600 },
);
console.log(
  "apps/worker/.env.local escrito (WORKER_SYSTEM_DATABASE_URL, WORKER_EXECUTOR_ID, WORKER_APP_VERSION, LOG_LEVEL, SUPABASE_URL, SUPABASE_SECRET_KEY, WEB_APP_URL)",
);
