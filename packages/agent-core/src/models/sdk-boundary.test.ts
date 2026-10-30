import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// Frontera de proveedores (ADR 0033 §4): ningún código fuera de
// packages/agent-core/src/models/transports habla con un proveedor de modelos.
// Así, la residencia, BYOK y los topes del enrutador no se pueden saltar.
const ROOT = join(import.meta.dirname, "..", "..", "..", "..");
const TRANSPORTS = "packages/agent-core/src/models/transports/";
// Este archivo lleva ejemplos de imports prohibidos como texto (los casos de abajo).
const SELF = "packages/agent-core/src/models/sdk-boundary.test.ts";

/** SDKs de proveedor (y los paquetes @ai-sdk/*), con import estático, dinámico o require. */
const PROVIDER_SDK_IMPORT =
  /(from\s+|import\s*\(\s*|require\s*\(\s*)["'](@ai-sdk\/[^"']+|@anthropic-ai\/sdk|openai|@google\/genai|@google-cloud\/vertexai|@aws-sdk\/client-bedrock-runtime|@mistralai\/mistralai|cohere-ai|groq-sdk)["']/;

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

describe("frontera de SDKs de proveedor (ADR 0033)", () => {
  it("revisa el código de las apps y de los paquetes", () => {
    const files = codeDirs.flatMap(sourceFiles).map((path) => relative(ROOT, path));
    expect(files.some((path) => path.startsWith("apps/web/"))).toBe(true);
    expect(files.some((path) => path.startsWith("apps/worker/"))).toBe(true);
    expect(files.some((path) => path.startsWith(TRANSPORTS))).toBe(true);
  });

  it("nada fuera de models/transports importa un SDK de proveedor", () => {
    const offenders = codeDirs
      .flatMap(sourceFiles)
      .map((path) => ({ path: relative(ROOT, path), text: readFileSync(path, "utf8") }))
      .filter(({ path, text }) => !path.startsWith(TRANSPORTS) && path !== SELF && PROVIDER_SDK_IMPORT.test(text))
      .map(({ path }) => path);
    expect(offenders).toEqual([]);
  });

  it.each([
    `import { anthropic } from "@ai-sdk/anthropic";`,
    `import OpenAI from "openai";`,
    `const sdk = await import("@aws-sdk/client-bedrock-runtime");`,
    `const { GoogleGenAI } = require("@google/genai");`,
  ])("detecta %s", (line) => {
    expect(PROVIDER_SDK_IMPORT.test(line)).toBe(true);
  });

  it.each([`import { z } from "zod";`, `import { openaiLike } from "./openai-like.js";`, `// usar openai más adelante`])(
    "no confunde %s con un SDK de proveedor",
    (line) => {
      expect(PROVIDER_SDK_IMPORT.test(line)).toBe(false);
    },
  );
});
