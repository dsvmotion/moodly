import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// AGENTS.md: prohibido usar la service role de Supabase en apps/web. La app
// solo conoce la URL y la clave publicable; cualquier referencia a la clave
// secreta o a la service role en el código de la app hace fallar este test.
const FORBIDDEN = [/service[_-]?role/i, /SECRET_KEY/, /sb_secret_/, /auth\.admin/];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(entry) && !entry.endsWith(".test.ts") ? [path] : [];
  });
}

describe("apps/web", () => {
  const root = join(import.meta.dirname, "..");
  const files = [...sourceFiles(join(root, "src")), ...sourceFiles(join(root, "scripts"))];

  it("tiene código que revisar", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it("no referencia la service role ni la clave secreta de Supabase", () => {
    const offenders = files.flatMap((file) => {
      const source = readFileSync(file, "utf8");
      return FORBIDDEN.filter((pattern) => pattern.test(source)).map((pattern) => `${relative(root, file)}: ${pattern}`);
    });
    expect(offenders).toEqual([]);
  });
});
