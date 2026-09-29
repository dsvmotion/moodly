// Escribe apps/web/.env.local a partir de `supabase status` (instancia local).
// Solo URL y clave publicable: la app nunca recibe la clave secreta.
// No imprime valores. Uso: pnpm --filter @repo/web env:local
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
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

writeFileSync(
  resolve(webRoot, ".env.local"),
  `NEXT_PUBLIC_SUPABASE_URL=${url}\nNEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${publishableKey}\n`,
);
console.log("apps/web/.env.local escrito (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)");
