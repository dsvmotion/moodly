// Claves de la instancia local de Supabase (`supabase status`), solo para
// scripts y tests de plataforma (seed, integración de tenantDb). Nunca código
// de apps/web.
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assertLocalSupabaseUrl } from "./local-only.ts";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

export interface LocalSupabase {
  apiUrl: string;
  secretKey: string;
  publishableKey: string;
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
  if (!apiUrl || !secretKey || !publishableKey) {
    throw new Error("supabase status no devuelve API_URL/SECRET_KEY/PUBLISHABLE_KEY: ¿está levantado (pnpm db:start)?");
  }

  assertLocalSupabaseUrl(apiUrl);
  return { apiUrl, secretKey, publishableKey };
}
