import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// Frontera de la plataforma de conectores (ADR 0053 §3): solo
// packages/integrations/src/platform/transports habla con Nango, sea con su
// SDK o con su API. El resto usa la interfaz ConnectorPlatform, así que cambiar
// de plataforma no toca a quien la usa.
const ROOT = join(import.meta.dirname, "..", "..", "..", "..");
const TRANSPORTS = "packages/integrations/src/platform/transports/";
// Este archivo lleva ejemplos de lo prohibido como texto.
const SELF = "packages/integrations/src/platform/boundary.test.ts";

/** Los SDK de Nango (cualquier @nangohq/…) con import estático, dinámico o require, o su API por URL. */
const NANGO_IMPORT = /(from\s+|import\s*\(\s*|require\s*\(\s*)["']@nangohq\/[^"']+["']/;
const NANGO_API = /["'`]https?:\/\/(api|connect)\.nango\.dev/;

function sourceFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (entry === "node_modules" || entry === "dist" || entry === ".next") return [];
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx|js|mjs)$/.test(entry) && !/\.test\.tsx?$/.test(entry) ? [path] : [];
  });
}

const codeDirs = ["apps", "packages"].flatMap((top) => readdirSync(join(ROOT, top)).map((name) => join(ROOT, top, name, "src")));

describe("frontera de la plataforma de conectores (ADR 0053 §3)", () => {
  it("revisa el código de las apps y de los paquetes", () => {
    const files = codeDirs.flatMap(sourceFiles).map((path) => relative(ROOT, path));
    expect(files.some((path) => path.startsWith("apps/web/"))).toBe(true);
    expect(files.some((path) => path.startsWith(TRANSPORTS))).toBe(true);
  });

  it("nada fuera de platform/transports importa Nango ni llama a su API", () => {
    const offenders = codeDirs
      .flatMap(sourceFiles)
      .map((path) => ({ path: relative(ROOT, path), text: readFileSync(path, "utf8") }))
      .filter(({ path, text }) => !path.startsWith(TRANSPORTS) && path !== SELF && (NANGO_IMPORT.test(text) || NANGO_API.test(text)))
      .map(({ path }) => path);
    expect(offenders).toEqual([]);
  });

  it.each([`import Nango from "@nangohq/frontend";`, `const { Nango } = await import("@nangohq/node");`, `fetch("https://api.nango.dev/proxy/x")`])(
    "detecta %s",
    (line) => {
      expect(NANGO_IMPORT.test(line) || NANGO_API.test(line)).toBe(true);
    },
  );

  it("no confunde la interfaz con Nango", () => {
    expect(NANGO_IMPORT.test(`import { createNangoPlatform } from "@repo/integrations";`)).toBe(false);
  });
});
