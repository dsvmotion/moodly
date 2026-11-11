import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { checkStatus, REPO_ROOT } from "./check.ts";
import { findProblems, parseFlowValue, parseScope, renderStatus, ScopeParseError } from "./scope-status.ts";

const SAMPLE = `version: 1
as_of_commit: abc1234
updated: 2026-11-10

milestones:
  M0: {name: "Seguro", gate: ["a", "b"]}
  M1: {name: "Columna", gate: ["c"]}

findings:
  - {id: "P-01", milestone: "M0", owner: "V1", status: "in_progress", evidence: ["PR #1", "abc"], note: "Con «comillas» y \\"escapes\\", y coma"}
  - {id: "K-03", milestone: "M0", owner: "V4", status: "done", evidence: ["PR #2"], note: "hecho"}

founder_tasks:
  - {id: "F01", name: "Reglas", milestone: "M0", status: "planned", evidence: []}

areas:
  use_cases:
    done_when: "algo"
    units:
      - {id: "RC1", role: "reception", name: "Find slots", milestone: "M1", owner: "V1", status: "blocked", evidence: [], note: "Sin canal"}
  integrations:
    pilot_target: {count: 50, level_2: 14}
    pilot_booking_system: {milestone: "M1", batch: "B", owner: "V1", status: "in_progress", note: "Falta cliente"}
    units:
      - {id: "I1", name: "Sistema", milestone: "after", owner: "V1", status: "planned", evidence: []}
`;

describe("parseFlowValue", () => {
  it("lee cadenas con escapes, listas, números y null", () => {
    expect(parseFlowValue('{a: "x\\"y", b: [1, "z", ], c: null, d: true, e: foo}')).toEqual({
      a: 'x"y',
      b: [1, "z"],
      c: null,
      d: true,
      e: "foo",
    });
  });
  it.each(['{a: "sin cerrar}', "{a 1}", '{a: "x"} sobra', '{a: ["x" "y"]}', "{a: }"])("rechaza %s", (src) => {
    expect(() => parseFlowValue(src)).toThrow(ScopeParseError);
  });
});

describe("parseScope", () => {
  const scope = parseScope(SAMPLE);
  it("lee cabecera, hitos y todas las unidades", () => {
    expect(scope.asOfCommit).toBe("abc1234");
    expect(scope.updated).toBe("2026-11-10");
    expect(scope.milestoneNames).toEqual({ M0: "Seguro", M1: "Columna" });
    expect(scope.items.map((i) => i.id)).toEqual(["P-01", "K-03", "F01", "RC1", "pilot_booking_system", "I1"]);
    expect(scope.items[0]?.text).toContain("«comillas» y \"escapes\", y coma");
  });
  it("una fila mal formada falla con su número de línea", () => {
    const bad = SAMPLE.replace('status: "blocked", evidence: [],', 'status: "blocked", evidence: [,');
    expect(() => parseScope(bad)).toThrow(/línea 20: fila mal formada/);
  });
  it("un estado desconocido falla", () => {
    expect(() => parseScope(SAMPLE.replace('"blocked"', '"hecho"'))).toThrow(/estado no válido «hecho»/);
  });
  it("una fila de unidades partida en varias líneas falla", () => {
    expect(() => parseScope(SAMPLE.replace('evidence: [], note: "Sin canal"}', "\n        evidence: []}"))).toThrow(
      /mal formada/,
    );
  });
  it("un id repetido falla", () => {
    const dup = SAMPLE.replace('  - {id: "F01"', '  - {id: "F01", name: "x", milestone: "M0", status: "planned", evidence: []}\n  - {id: "F01"');
    expect(() => parseScope(dup)).toThrow(/id repetido F01/);
  });
});

describe("findProblems y renderStatus", () => {
  it("marca done sin evidencia y hitos desconocidos", () => {
    const scope = parseScope(
      SAMPLE.replace('status: "done", evidence: ["PR #2"]', 'status: "done", evidence: []').replace('milestone: "after"', 'milestone: "M9"'),
    );
    expect(findProblems(scope)).toEqual([
      expect.stringContaining("K-03"),
      expect.stringContaining("hito desconocido «M9»"),
    ]);
    expect(renderStatus(scope)).toContain("marcada done sin evidencia");
  });
  it("cuenta por estado y lista solo lo abierto", () => {
    const text = renderStatus(parseScope(SAMPLE));
    expect(text).toContain("| M0 | Seguro | 3 | 1 | 1 | 0 | 1 |");
    expect(text).toContain("| M1 | Columna | 2 | 0 | 1 | 1 | 0 |");
    expect(text).toContain("| after | - | 1 | 0 | 0 | 0 | 1 |");
    expect(text).toContain("`P-01` · V1 · in_progress");
    expect(text).toContain("`RC1` · V1 · blocked · Find slots: Sin canal · sin evidencia");
    expect(text).not.toContain("`F01` ·");
    expect(text).not.toContain("`K-03` ·");
    expect(text).toContain("Ninguno: toda unidad");
  });
  it("es determinista y corta", () => {
    expect(renderStatus(parseScope(SAMPLE))).toBe(renderStatus(parseScope(SAMPLE)));
  });
});

describe("docs/STATUS.generated.md (check de CI, P-08)", () => {
  it("está al día con docs/scope.yaml, sin unidades done sin evidencia", () => {
    const result = checkStatus();
    expect(result.messages).toEqual([]);
    expect(result.ok).toBe(true);
  });
  it("el resumen real cabe en unas 80 líneas", () => {
    const text = readFileSync(join(REPO_ROOT, "docs/STATUS.generated.md"), "utf8");
    expect(text.split("\n").length).toBeLessThanOrEqual(80);
  });
});
