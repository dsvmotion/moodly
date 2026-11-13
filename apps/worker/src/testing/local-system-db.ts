// Conexiones del worker a Supabase local: la base de datos de sistema de DBOS
// (rol dbos_worker, con la contraseña que le da `pnpm db:seed`) y la API con su
// clave secreta. Solo para el entorno local: tests de integración y
// `pnpm --filter @repo/worker env:local`.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const dbRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../packages/db");
const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);

function localStatus(): Record<string, string | undefined> {
  return JSON.parse(
    execFileSync("supabase", ["status", "-o", "json"], { cwd: dbRoot, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }),
  ) as Record<string, string | undefined>;
}

/** API de Supabase local y su clave secreta (SUPABASE_URL y SUPABASE_SECRET_KEY del worker). */
export function localSupabaseApi(): { url: string; secretKey: string } {
  const status = localStatus();
  const url = status["API_URL"];
  const secretKey = status["SECRET_KEY"];
  if (!url || !secretKey) throw new Error("supabase status no devuelve API_URL y SECRET_KEY: ¿está levantado (pnpm db:start)?");
  if (!LOCAL_HOSTS.has(new URL(url).hostname)) throw new Error(`Solo contra Supabase local; API_URL apunta a ${new URL(url).hostname}`);
  return { url, secretKey };
}

/** Postgres local como postgres, para preparar datos en los tests de integración. */
export function localAdminDatabaseUrl(): string {
  const dbUrl = localStatus()["DB_URL"];
  if (!dbUrl) throw new Error("supabase status no devuelve DB_URL: ¿está levantado (pnpm db:start)?");
  if (!LOCAL_HOSTS.has(new URL(dbUrl).hostname)) throw new Error(`Solo contra Supabase local; DB_URL apunta a ${new URL(dbUrl).hostname}`);
  return dbUrl;
}

export function localSystemDatabaseUrl(): string {
  const status = localStatus();
  const dbUrl = status["DB_URL"];
  if (!dbUrl) throw new Error("supabase status no devuelve DB_URL: ¿está levantado (pnpm db:start)?");

  const url = new URL(dbUrl);
  if (!LOCAL_HOSTS.has(url.hostname)) throw new Error(`Solo contra Supabase local; DB_URL apunta a ${url.hostname}`);

  const keysFile = resolve(dbRoot, ".seed/server-keys.local.json");
  if (!existsSync(keysFile)) throw new Error("Falta la contraseña local de dbos_worker: ejecuta antes pnpm db:seed.");
  const password = (JSON.parse(readFileSync(keysFile, "utf8")) as Record<string, string | undefined>)["worker_db_password"];
  if (!password) throw new Error("server-keys.local.json no tiene worker_db_password: ejecuta pnpm db:seed.");

  url.username = "dbos_worker";
  url.password = password;
  return url.toString();
}

/** Postgres local como moodly_worker (ADR 0049): los datos de las organizaciones bajo RLS. Su contraseña la pone `pnpm db:seed`. */
export function localWorkerDatabaseUrl(): string {
  const dbUrl = localStatus()["DB_URL"];
  if (!dbUrl) throw new Error("supabase status no devuelve DB_URL: ¿está levantado (pnpm db:start)?");
  const url = new URL(dbUrl);
  if (!LOCAL_HOSTS.has(url.hostname)) throw new Error(`Solo contra Supabase local; DB_URL apunta a ${url.hostname}`);
  const keysFile = resolve(dbRoot, ".seed/server-keys.local.json");
  if (!existsSync(keysFile)) throw new Error("Falta la contraseña local de moodly_worker: ejecuta antes pnpm db:seed.");
  const password = (JSON.parse(readFileSync(keysFile, "utf8")) as Record<string, string | undefined>)["worker_rls_password"];
  if (!password) throw new Error("server-keys.local.json no tiene worker_rls_password: ejecuta pnpm db:seed.");
  url.username = "moodly_worker";
  url.password = password;
  return url.toString();
}
