import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// Frontera de MCP (ADR 0036): solo packages/integrations/src/mcp/transports
// habla con un servidor MCP. El resto llama a través de governMcpClient, así
// que la lista de herramientas revisadas, la huella, los campos reservados y
// los límites no se pueden saltar.
const ROOT = join(import.meta.dirname, "..", "..", "..", "..");
const TRANSPORTS = "packages/integrations/src/mcp/transports/";
// Este archivo lleva ejemplos de imports prohibidos como texto (los casos de abajo).
const SELF = "packages/integrations/src/mcp/sdk-boundary.test.ts";

/** El SDK oficial de MCP (y cualquier paquete de @modelcontextprotocol), con import estático, dinámico o require. */
const MCP_SDK_IMPORT = /(from\s+|import\s*\(\s*|require\s*\(\s*)["'](@modelcontextprotocol\/[^"']+|mcp-remote|fastmcp)["']/;

function sourceFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (entry === "node_modules" || entry === "dist" || entry === ".next") return [];
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx|js|mjs)$/.test(entry) ? [path] : [];
  });
}

const codeDirs = ["apps", "packages"].flatMap((top) =>
  readdirSync(join(ROOT, top)).map((name) => join(ROOT, top, name, "src")),
);

describe("frontera de MCP (ADR 0036)", () => {
  it("revisa el código de las apps y de los paquetes", () => {
    const files = codeDirs.flatMap(sourceFiles).map((path) => relative(ROOT, path));
    expect(files.some((path) => path.startsWith("apps/worker/"))).toBe(true);
    expect(files.some((path) => path.startsWith("packages/integrations/src/mcp/"))).toBe(true);
  });

  it("nada fuera de mcp/transports importa un cliente MCP", () => {
    const offenders = codeDirs
      .flatMap(sourceFiles)
      .map((path) => ({ path: relative(ROOT, path), text: readFileSync(path, "utf8") }))
      .filter(({ path, text }) => !path.startsWith(TRANSPORTS) && path !== SELF && MCP_SDK_IMPORT.test(text))
      .map(({ path }) => path);
    expect(offenders).toEqual([]);
  });

  it.each([
    `import { Client } from "@modelcontextprotocol/sdk/client/index.js";`,
    `const { StreamableHTTPClientTransport } = await import("@modelcontextprotocol/sdk/client/streamableHttp.js");`,
    `const mcp = require("fastmcp");`,
  ])("detecta %s", (line) => {
    expect(MCP_SDK_IMPORT.test(line)).toBe(true);
  });

  it.each([`import { governMcpClient } from "@repo/integrations";`, `import type { McpClient } from "./types.js";`])(
    "no confunde %s con un cliente MCP",
    (line) => {
      expect(MCP_SDK_IMPORT.test(line)).toBe(false);
    },
  );
});
