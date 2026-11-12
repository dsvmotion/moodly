// Claves de la instancia local de Supabase (`supabase status`), solo para
// scripts y tests de plataforma (seed, integración de tenantDb). Nunca código
// de apps/web.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assertLocalSupabaseUrl } from "./local-only.ts";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

export interface LocalSupabase {
  apiUrl: string;
  secretKey: string;
  publishableKey: string;
  /** Postgres local con el rol postgres (solo para el seed: da login a dbos_worker). */
  dbUrl: string;
}

export function readLocalSupabase(): LocalSupabase {
  const raw = execFileSync("supabase", ["status", "-o", "json"], {
    cwd: packageRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  const status = JSON.parse(raw) as Record<string, string | undefined>;
  const apiUrl = status["API_URL"];
  const secretKey = status["SECRET_KEY"] ?? status["SERVICE_ROLE_KEY"];
  const publishableKey = status["PUBLISHABLE_KEY"] ?? status["ANON_KEY"];
  const dbUrl = status["DB_URL"];
  if (!apiUrl || !secretKey || !publishableKey || !dbUrl) {
    throw new Error("supabase status no devuelve API_URL/SECRET_KEY/PUBLISHABLE_KEY/DB_URL: ¿está levantado (pnpm db:start)?");
  }

  assertLocalSupabaseUrl(apiUrl);
  assertLocalSupabaseUrl(dbUrl);
  return { apiUrl, secretKey, publishableKey, dbUrl };
}

/**
 * La URL local del rol moodly_worker (ADR 0049), con la contraseña que le da
 * `pnpm db:seed` (packages/db/.seed/server-keys.local.json). Solo local.
 */
export function localWorkerDatabaseUrl(local: LocalSupabase = readLocalSupabase()): string {
  const keysFile = resolve(packageRoot, ".seed/server-keys.local.json");
  if (!existsSync(keysFile)) throw new Error("falta packages/db/.seed/server-keys.local.json: ejecuta pnpm db:seed");
  const keys = JSON.parse(readFileSync(keysFile, "utf8")) as Record<string, string | undefined>;
  const password = keys["worker_rls_password"];
  if (!password) throw new Error("el seed no ha dado login a moodly_worker: ejecuta pnpm db:seed");
  const url = new URL(local.dbUrl);
  url.username = "moodly_worker";
  url.password = password;
  assertLocalSupabaseUrl(url.toString());
  return url.toString();
}
