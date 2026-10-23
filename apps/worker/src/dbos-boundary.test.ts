import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// ADR 0027 («Aislamiento del motor»): solo apps/worker importa DBOS. El resto
// del código usa la interfaz de packages/agent-core, así que cambiar de motor
// solo toca el worker. Refuerza la regla de eslint.config.js y cubre lo que la
// regla no ve (imports dinámicos, require y apps que no pasan el lint).
const ROOT = join(import.meta.dirname, "..", "..", "..");
const DBOS_IMPORT = /(from\s+|import\s*\(\s*|require\s*\(\s*)["']@dbos-inc\//;

function sourceFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (entry === "node_modules" || entry === "dist" || entry === ".next") return [];
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx|js|mjs|cjs)$/.test(entry) ? [path] : [];
  });
}

const outsideWorker = [
  ...readdirSync(join(ROOT, "apps"))
    .filter((name) => name !== "worker")
    .map((name) => join(ROOT, "apps", name)),
  ...readdirSync(join(ROOT, "packages")).map((name) => join(ROOT, "packages", name)),
];

describe("solo apps/worker importa DBOS (ADR 0027)", () => {
  it("hay código que revisar fuera del worker, y el worker sí importa DBOS", () => {
    expect(outsideWorker.flatMap(sourceFiles).length).toBeGreaterThan(50);
    const worker = readFileSync(join(ROOT, "apps", "worker", "src", "worker.ts"), "utf8");
    expect(DBOS_IMPORT.test(worker)).toBe(true);
  });

  it("ninguna app ni paquete fuera de apps/worker importa @dbos-inc", () => {
    const offenders = outsideWorker
      .flatMap(sourceFiles)
      .filter((path) => DBOS_IMPORT.test(readFileSync(path, "utf8")))
      .map((path) => relative(ROOT, path));
    expect(offenders).toEqual([]);
  });

  it("ningún package.json fuera de apps/worker depende de @dbos-inc", () => {
    const offenders = outsideWorker
      .map((dir) => join(dir, "package.json"))
      .filter((path) => existsSync(path) && readFileSync(path, "utf8").includes('"@dbos-inc/'))
      .map((path) => relative(ROOT, path));
    expect(offenders).toEqual([]);
  });
});
