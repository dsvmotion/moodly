import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { AGENT_TYPES } from "@repo/config";

// ADR 0030 §1: AGENT_TYPES es la semilla del catálogo, no la lista completa.
// Ningún código de negocio supone que hay 4 agentes ni hace lógica sobre su
// clave (switch, if, mapas por clave): la interfaz pinta cualquier agente con
// sus datos (agent_types y agents). Este test falla si una clave de agente de
// serie aparece escrita en el código, o si se usa AGENT_TYPES fuera de
// packages/config, salvo en tests.
const ROOT = join(import.meta.dirname, "..", "..", "..");
const ALLOWED = new Set(["packages/config/src/index.ts"]);

function sourceFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (entry === "node_modules" || entry === "dist" || entry === ".next") return [];
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(entry) && !/\.(test|e2e)\.tsx?$/.test(entry) ? [path] : [];
  });
}

const packages = readdirSync(join(ROOT, "packages")).map((name) => join(ROOT, "packages", name, "src"));
const files = [join(ROOT, "apps", "web", "src"), join(ROOT, "apps", "worker", "src"), ...packages]
  .flatMap(sourceFiles)
  .map((path) => ({ path: relative(ROOT, path), text: readFileSync(path, "utf8") }))
  .filter(({ path }) => !ALLOWED.has(path));

describe("ninguna lógica sobre claves de agente (ADR 0030 §1)", () => {
  it("hay código que revisar en apps/web y en packages", () => {
    expect(files.some(({ path }) => path.startsWith("apps/web/src/"))).toBe(true);
    expect(files.some(({ path }) => path.startsWith("packages/"))).toBe(true);
  });

  it("ninguna clave de agente de serie aparece escrita en el código", () => {
    const keys = AGENT_TYPES.map((type) => type.key).join("|");
    const literal = new RegExp(`["'\`](${keys})["'\`]`);
    const offenders = files.filter(({ text }) => literal.test(text)).map(({ path }) => path);
    expect(offenders).toEqual([]);
  });

  it("AGENT_TYPES solo se usa en packages/config (es la semilla, no la lista de agentes)", () => {
    const offenders = files.filter(({ text }) => /\bAGENT_TYPES\b|\bAgentTypeKey\b/.test(text)).map(({ path }) => path);
    expect(offenders).toEqual([]);
  });
});
