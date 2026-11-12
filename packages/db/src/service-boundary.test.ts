import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// Revisión de seguridad 3.2 (MANUAL §4.4): con la clave secreta no hay RLS,
// así que el acceso de plataforma a los datos de una organización pasa siempre
// por createServiceDb().forOrganization(orgId) (@repo/db/service). Refuerza la
// regla de eslint.config.js y cubre lo que la regla no ve.
const ROOT = join(import.meta.dirname, "..", "..", "..");
// Cualquier paquete de Supabase (supabase-js, ssr, postgrest-js...), con import
// estático, dinámico o require.
const SUPABASE_IMPORT = /(from\s+|import\s*\(\s*|require\s*\(\s*)["']@supabase\//;
const VALUE_IMPORT = /^import\s+(?!type\b)[^;]*from\s+["']@supabase\/supabase-js["']/m;

function sourceFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (entry === "node_modules" || entry === "dist" || entry === ".next") return [];
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(entry) && !/\.(test|e2e|integration)\.tsx?$/.test(entry) ? [path] : [];
  });
}

function read(paths: string[]): { path: string; text: string }[] {
  return paths.map((path) => ({ path: relative(ROOT, path), text: readFileSync(path, "utf8") }));
}

const backendDirs = [
  join(ROOT, "apps", "worker", "src"),
  ...readdirSync(join(ROOT, "packages"))
    .filter((name) => name !== "db")
    .map((name) => join(ROOT, "packages", name, "src")),
];

describe("acceso de plataforma acotado a una organización (3.2)", () => {
  it("hay código que revisar en el worker, en los paquetes y en packages/db", () => {
    const backend = read(backendDirs.flatMap(sourceFiles));
    expect(backend.some(({ path }) => path.startsWith("apps/worker/"))).toBe(true);
    expect(backend.some(({ path }) => path.startsWith("packages/"))).toBe(true);
    expect(sourceFiles(join(ROOT, "packages", "db", "src")).length).toBeGreaterThan(3);
  });

  it("ni el worker ni los paquetes (salvo packages/db) importan un cliente de Supabase", () => {
    const offenders = read(backendDirs.flatMap(sourceFiles))
      .filter(({ text }) => SUPABASE_IMPORT.test(text))
      .map(({ path }) => path);
    expect(offenders).toEqual([]);
  });

  it("en packages/db, solo service.ts crea el cliente de plataforma (y el seed, que es local)", () => {
    const creators = read(sourceFiles(join(ROOT, "packages", "db", "src")))
      .filter(({ text }) => VALUE_IMPORT.test(text))
      .map(({ path }) => path)
      .sort();
    expect(creators).toEqual(["packages/db/src/seed/run.ts", "packages/db/src/service.ts"]);
  });

  it("@repo/db (la raíz, que usa apps/web) no expone el cliente de plataforma", () => {
    const index = readFileSync(join(ROOT, "packages", "db", "src", "index.ts"), "utf8");
    expect(index).not.toMatch(/service|tenant-db|createClient/);
  });

  it("las lecturas entre organizaciones son exactamente dos: el outbox y la cuenta de un canal (ADR 0009, ADR 0052 §2)", () => {
    const service = readFileSync(join(ROOT, "packages", "db", "src", "service.ts"), "utf8");
    const surface = /export interface ServiceDb \{([\s\S]*?)\n\}/.exec(service)?.[1] ?? "";
    const members = [...surface.matchAll(/^\s{2}(\w+)[(:]/gm)].map((match) => match[1]).sort();
    // end (de #231) solo cierra las conexiones de moodly_worker: no lee nada.
    expect(members).toEqual(["channelAccounts", "end", "forOrganization", "outbox"]);
    expect(surface).toMatch(/^\s{2}end\(\): Promise<void>;$/m);
    // La cuenta de un canal: una sola tabla, solo id, organización y estado, por igualdad exacta.
    const resolver = readFileSync(join(ROOT, "packages", "db", "src", "channel-accounts.ts"), "utf8");
    expect([...resolver.matchAll(/\.from\("(\w+)"\)/g)].map((match) => match[1])).toEqual(["channel_accounts"]);
    expect([...resolver.matchAll(/\.select\("([^"]*)"\)/g)].map((match) => match[1])).toEqual(["id, organization_id, status"]);
    expect(resolver).not.toMatch(/\.(update|insert|delete|upsert|rpc|ilike|like|in|or)\(/);
  });

  it("apps/web no importa @repo/db/service", () => {
    const offenders = read(sourceFiles(join(ROOT, "apps", "web", "src")))
      .filter(({ text }) => /["']@repo\/db\/service["']/.test(text))
      .map(({ path }) => path);
    expect(offenders).toEqual([]);
  });
});
