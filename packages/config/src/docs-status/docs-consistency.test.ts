import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { REPO_ROOT } from "./check.ts";

// Coherencia de los documentos que mandan (CLAUDE.md, ADR 0023): cada ADR dice su
// estado, los números de ADR no se repiten y CLAUDE.md y AGENTS.md son el mismo texto.
const ADR_DIR = join(REPO_ROOT, "docs", "adr");

/** Los ADR de verdad: archivos `NNNN-….md` (la plantilla 0000 incluida). */
export function adrFiles(dir: string = ADR_DIR): string[] {
  return readdirSync(dir).filter((f) => /^\d{4}-.*\.md$/.test(f)).sort();
}

/** Línea de estado: `- **Estado:** aceptado | propuesto | sustituido por …`. */
export const STATUS_LINE = /^\s*[-*]\s*\*\*Estado:\*\*\s*(aceptado|propuesto|sustituido|rechazado|obsoleto)\b/im;

/** Números de ADR repetidos entre archivos y carpetas (p. ej. `0027-spike/`). */
export function duplicatedNumbers(entries: string[]): Map<string, string[]> {
  const byNumber = new Map<string, string[]>();
  for (const e of entries) {
    const n = /^(\d{4})-/.exec(e)?.[1];
    if (n !== undefined) byNumber.set(n, [...(byNumber.get(n) ?? []), e]);
  }
  return new Map([...byNumber].filter(([, v]) => v.length > 1));
}

// Excepción conocida: el spike de DBOS vive en la carpeta `0027-spike/` al lado del
// ADR `0027-ejecucion-duradera-dbos.md`. Cualquier otro número repetido es un error.
const KNOWN_DUPLICATES = { "0027": ["0027-ejecucion-duradera-dbos.md", "0027-spike"] };

describe("docs/adr", () => {
  const files = adrFiles();

  it("hay ADR que comprobar", () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it("cada ADR tiene una línea de estado reconocible", () => {
    const without = files.filter((f) => !STATUS_LINE.test(readFileSync(join(ADR_DIR, f), "utf8")));
    expect(without).toEqual([]);
  });

  it("la línea de estado rechaza lo que no lo es", () => {
    expect(STATUS_LINE.test("- **Estado:** propuesto | aceptado")).toBe(true);
    expect(STATUS_LINE.test("- **Estado:** aceptado (producto, 2026-11-11)")).toBe(true);
    expect(STATUS_LINE.test("Estado: aceptado")).toBe(false);
    expect(STATUS_LINE.test("- **Estado:** quizá")).toBe(false);
  });

  it("ningún número de ADR se repite, salvo el spike de 0027", () => {
    const entries = readdirSync(ADR_DIR).filter((e) => /^\d{4}-/.test(e));
    expect(Object.fromEntries(duplicatedNumbers(entries))).toEqual(KNOWN_DUPLICATES);
  });

  it("detecta un número repetido", () => {
    expect(duplicatedNumbers(["0001-a.md", "0001-b.md", "0002-c.md"]).get("0001")).toEqual(["0001-a.md", "0001-b.md"]);
  });
});

describe("CLAUDE.md y AGENTS.md", () => {
  it("tienen exactamente el mismo contenido (byte a byte)", () => {
    const claude = join(REPO_ROOT, "CLAUDE.md");
    const agents = join(REPO_ROOT, "AGENTS.md");
    expect(existsSync(claude) && existsSync(agents)).toBe(true);
    expect(readFileSync(claude).equals(readFileSync(agents))).toBe(true);
  });
});
