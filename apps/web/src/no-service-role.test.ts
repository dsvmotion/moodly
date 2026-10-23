import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// AGENTS.md: prohibido usar la service role de Supabase en apps/web. La app
// solo conoce la URL y la clave publicable; cualquier referencia a la clave
// secreta o a la service role en su código o en .env.example hace fallar
// este test, y solo se permiten estas variables NEXT_PUBLIC_* (las que llegan
// al navegador): las públicas de Supabase y el DSN y el entorno de Sentry, que
// también son públicos por diseño (ADR 0032).
const FORBIDDEN = [/service[_-]?role/i, /SECRET_KEY/, /sb_secret_/, /auth\.admin/];
const ALLOWED_PUBLIC_VARS = [
  "NEXT_PUBLIC_SENTRY_DSN",
  "NEXT_PUBLIC_SENTRY_ENVIRONMENT",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(entry) && !entry.endsWith(".test.ts") ? [path] : [];
  });
}

describe("apps/web", () => {
  const root = join(import.meta.dirname, "..");
  const envExample = join(root, ".env.example");
  const files = [
    ...sourceFiles(join(root, "src")),
    ...sourceFiles(join(root, "scripts")),
    join(root, "next.config.ts"),
    envExample,
  ];

  it("tiene código y .env.example que revisar", () => {
    expect(files.length).toBeGreaterThan(3);
    expect(existsSync(envExample)).toBe(true);
  });

  it("no referencia la service role ni la clave secreta de Supabase", () => {
    const offenders = files.flatMap((file) => {
      const source = readFileSync(file, "utf8");
      return FORBIDDEN.filter((pattern) => pattern.test(source)).map((pattern) => `${relative(root, file)}: ${pattern}`);
    });
    expect(offenders).toEqual([]);
  });

  it("solo usa las variables NEXT_PUBLIC_* permitidas (Supabase: URL y clave publicable; Sentry: DSN y entorno)", () => {
    const used = new Set(files.flatMap((file) => readFileSync(file, "utf8").match(/NEXT_PUBLIC_[A-Z0-9_]+/g) ?? []));
    expect([...used].sort()).toEqual(ALLOWED_PUBLIC_VARS);
  });
});
