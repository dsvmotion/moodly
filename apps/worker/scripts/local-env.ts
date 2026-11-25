// Escribe apps/worker/.env.local para `pnpm --filter @repo/worker dev`, contra
// Supabase local: los roles dbos_worker y moodly_worker (sus contraseñas las pone
// `pnpm db:seed`) y la API con la clave secreta local. No imprime valores.
// Uso: pnpm --filter @repo/worker env:local
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { localSupabaseApi, localSystemDatabaseUrl, localWorkerDatabaseUrl } from "../src/testing/local-system-db.ts";

const envFile = resolve(dirname(fileURLToPath(import.meta.url)), "../.env.local");

const api = localSupabaseApi();
// Las claves locales del alta de claves de integraciones (ADR 0055; las genera
// `pnpm db:seed`): la privada de ingreso y la maestra de SecretVault.
const keysFile = resolve(dirname(fileURLToPath(import.meta.url)), "../../../packages/db/.seed/server-keys.local.json");
const serverKeys = (existsSync(keysFile) ? JSON.parse(readFileSync(keysFile, "utf8")) : {}) as Record<string, string | undefined>;
const ingressPrivatePem = serverKeys["integration_ingress_private_pem"];
const vaultKey = serverKeys["secret_vault_local"];
if (!ingressPrivatePem || !vaultKey) throw new Error("server-keys.local.json no tiene las claves locales de integraciones: ejecuta pnpm db:seed.");
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
    `WORKER_DATABASE_URL=${localWorkerDatabaseUrl()}`,
    // Los enlaces de los avisos por email, a la web local. Sin RESEND_API_KEY no se envían.
    "WEB_APP_URL=http://127.0.0.1:3000",
    `SECRET_VAULT_LOCAL_KEY=${vaultKey}`,
    `INTEGRATION_INGRESS_LOCAL_PRIVATE_KEY=${Buffer.from(ingressPrivatePem, "utf8").toString("base64")}`,
    "",
  ].join("\n"),
  { mode: 0o600 },
);
console.log(
  "apps/worker/.env.local escrito (WORKER_SYSTEM_DATABASE_URL, WORKER_EXECUTOR_ID, WORKER_APP_VERSION, LOG_LEVEL, SUPABASE_URL, SUPABASE_SECRET_KEY, WORKER_DATABASE_URL, WEB_APP_URL, SECRET_VAULT_LOCAL_KEY, INTEGRATION_INGRESS_LOCAL_PRIVATE_KEY)",
);
