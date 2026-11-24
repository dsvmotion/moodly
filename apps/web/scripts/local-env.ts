// Escribe apps/web/.env.local a partir de `supabase status` (instancia local).
// Solo URL y clave publicable: la app nunca recibe la clave secreta. Añade la
// clave de servidor del freno del login, que genera y registra `pnpm db:seed`
// (no da acceso a datos: solo permite usar el freno), la de los seudónimos de
// los logs y la parte pública de la clave de ingreso local (ADR 0055).
// No imprime valores. Uso: pnpm --filter @repo/web env:local
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dbRoot = resolve(webRoot, "../../packages/db");

const status = JSON.parse(
  execFileSync("supabase", ["status", "-o", "json"], { cwd: dbRoot, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }),
) as Record<string, string | undefined>;

const url = status["API_URL"];
const publishableKey = status["PUBLISHABLE_KEY"] ?? status["ANON_KEY"];
if (!url || !publishableKey) throw new Error("supabase status no devuelve API_URL/PUBLISHABLE_KEY: ¿está levantado (pnpm db:start)?");

const serverKeysFile = resolve(dbRoot, ".seed/server-keys.local.json");
if (!existsSync(serverKeysFile)) throw new Error("Falta la clave del freno del login: ejecuta antes pnpm db:seed.");
const serverKeys = JSON.parse(readFileSync(serverKeysFile, "utf8")) as Record<string, string | undefined>;
const loginThrottleKey = serverKeys["login_throttle"];
if (!loginThrottleKey) throw new Error("server-keys.local.json no tiene login_throttle: ejecuta pnpm db:seed.");

// Clave de los seudónimos de los logs (ADR 0032): se conserva entre ejecuciones
// para que los seudónimos de un mismo email no cambien.
const envFile = resolve(webRoot, ".env.local");
const previousKey = existsSync(envFile) ? /^LOG_PSEUDONYM_KEY=(.+)$/m.exec(readFileSync(envFile, "utf8"))?.[1] : undefined;
const logPseudonymKey = previousKey ?? randomBytes(32).toString("base64url");

// La parte pública de la clave de ingreso local (ADR 0055): con ella la web
// cifra la clave de una integración hacia el worker. No es secreta.
const ingressPublicKey = serverKeys["integration_ingress_public_spki"];
if (!ingressPublicKey) throw new Error("server-keys.local.json no tiene la clave de ingreso: ejecuta pnpm db:seed.");

writeFileSync(
  envFile,
  [
    `NEXT_PUBLIC_SUPABASE_URL=${url}`,
    `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${publishableKey}`,
    `LOGIN_THROTTLE_KEY=${loginThrottleKey}`,
    `LOG_PSEUDONYM_KEY=${logPseudonymKey}`,
    `INTEGRATION_INGRESS_PUBLIC_KEY=${ingressPublicKey}`,
    "INTEGRATION_INGRESS_KEY_REF=local:v1",
    "",
  ].join("\n"),
  { mode: 0o600 },
);
console.log(
  "apps/web/.env.local escrito (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, LOGIN_THROTTLE_KEY, LOG_PSEUDONYM_KEY, INTEGRATION_INGRESS_PUBLIC_KEY, INTEGRATION_INGRESS_KEY_REF)",
);
