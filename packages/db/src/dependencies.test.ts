import { readdirSync, readFileSync, statSync } from "node:fs";
import { builtinModules } from "node:module";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// La imagen del worker instala solo las dependencias de producción
// (`pnpm install --prod`, apps/worker/Dockerfile): un paquete que el código
// compilado de @repo/db importa en tiempo de ejecución y que solo está en
// devDependencies no llega, y el worker no arranca (ERR_MODULE_NOT_FOUND).
// Lo que entra en el build es lo de tsconfig.build.json: src sin tests,
// integración ni seed.
const SRC = join(import.meta.dirname);
const pkg = JSON.parse(readFileSync(join(SRC, "..", "package.json"), "utf8")) as { dependencies?: Record<string, string> };

function buildFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return relative(SRC, path) === "seed" ? [] : buildFiles(path);
    return entry.endsWith(".ts") && !entry.endsWith(".test.ts") && !entry.endsWith(".integration.ts") ? [path] : [];
  });
}

/** Los paquetes que un archivo importa como valor (no `import type`). */
function runtimeImports(source: string): string[] {
  const specifiers = [...source.matchAll(/^\s*(?:import|export)\s+(?!type\b)[^;]*?from\s+["']([^"']+)["']/gm)].map((m) => m[1] ?? "");
  return specifiers
    .filter((s) => !s.startsWith(".") && !s.startsWith("node:") && !builtinModules.includes(s))
    .map((s) => (s.startsWith("@") ? s.split("/").slice(0, 2).join("/") : (s.split("/")[0] ?? s)));
}

describe("dependencias de producción de @repo/db", () => {
  it("todo lo que importa el código compilado está en dependencies (no solo en devDependencies)", () => {
    const missing = buildFiles(SRC).flatMap((file) =>
      runtimeImports(readFileSync(file, "utf8"))
        .filter((name) => !(name in (pkg.dependencies ?? {})))
        .map((name) => `${relative(SRC, file)} → ${name}`),
    );
    expect(missing).toEqual([]);
  });

  it("se da cuenta de que worker-sql importa pg", () => {
    expect(runtimeImports(readFileSync(join(SRC, "worker-sql.ts"), "utf8"))).toContain("pg");
  });
});
