// URL de la base de datos de sistema de DBOS en Supabase local, con el rol
// dbos_worker y la contraseña que le da `pnpm db:seed`. Solo para el entorno
// local: tests de integración y `pnpm --filter @repo/worker env:local`.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const dbRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../packages/db");
const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);

export function localSystemDatabaseUrl(): string {
  const status = JSON.parse(
    execFileSync("supabase", ["status", "-o", "json"], { cwd: dbRoot, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }),
  ) as Record<string, string | undefined>;
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
