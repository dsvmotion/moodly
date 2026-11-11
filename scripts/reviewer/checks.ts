// Comprobaciones fijas, sin modelo. En el nivel 0 son toda la revisión; en los
// niveles 1 y 2 también se pasan, y si alguna falla el PR no se aprueba.

export interface CheckResult {
  name: string;
  ok: boolean;
  detail: string;
}

/** `[M0][P-08] …` o `[M0][SE01][P-08] …`: el hito y al menos un id (WORKSTREAMS, regla 1). */
const TITLE = /^\[M[0-5]\]((?:\[[A-Z]{1,3}-?\d{1,3}\])+)/;

export function idsFromTitle(title: string): string[] {
  const match = TITLE.exec(title.trim());
  if (!match?.[1]) return [];
  return [...match[1].matchAll(/\[([^\]]+)\]/g)].map((m) => m[1] ?? "").filter(Boolean);
}

/**
 * Las filas de `docs/scope.yaml` que dicen `done` sin evidencia. El registro usa
 * una fila por línea (`{id: "…", …, status: "done", evidence: […]}`); una fila
 * `done` con `evidence: []` o sin `evidence` no vale.
 */
export function doneWithoutEvidence(scopeYaml: string): string[] {
  return scopeYaml
    .split("\n")
    .filter((line) => /status:\s*"?done"?/.test(line))
    .filter((line) => !/evidence:\s*\[\s*"/.test(line))
    .map((line) => /id:\s*"([^"]+)"/.exec(line)?.[1] ?? line.trim().slice(0, 60));
}

export function hasScopeRow(scopeYaml: string, id: string): boolean {
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`id:\\s*"${escaped}"`).test(scopeYaml);
}

export function fixedChecks(input: {
  title: string;
  /** Salida de scripts/merge-guard/check-sensitive.sh sobre los archivos y el diff (0, 1 o 2). */
  guardExit: number;
  guardOutput: string;
  /** `docs/scope.yaml` en el head del PR, o null si no existe. */
  scopeYaml: string | null;
}): CheckResult[] {
  const results: CheckResult[] = [];
  const weakened = input.guardOutput
    .split("\n")
    .filter((line) => line.startsWith("TEST DEBILITADO") || line.startsWith("TEST BORRADO"));
  results.push({
    name: "guarda: ningún test debilitado ni borrado",
    ok: input.guardExit !== 2 && weakened.length === 0,
    detail: input.guardExit === 2 ? "la guarda no pudo leer los archivos o el diff" : weakened.join("\n") || "sin tests debilitados",
  });

  const ids = idsFromTitle(input.title);
  results.push({
    name: "título con el hito y el id (`[Mx][ID]`)",
    ok: ids.length > 0,
    detail: ids.length > 0 ? ids.join(", ") : `el título no empieza por [Mx][ID]: «${input.title.slice(0, 80)}»`,
  });

  if (input.scopeYaml === null) {
    results.push({ name: "fila en docs/scope.yaml", ok: false, detail: "no hay docs/scope.yaml en el head del PR" });
    return results;
  }
  const missing = ids.filter((id) => !hasScopeRow(input.scopeYaml ?? "", id));
  results.push({
    name: "cada id del título tiene su fila en docs/scope.yaml",
    ok: ids.length > 0 && missing.length === 0,
    detail: missing.length > 0 ? `sin fila: ${missing.join(", ")}` : ids.length > 0 ? "todas las filas existen" : "sin ids",
  });
  const unproven = doneWithoutEvidence(input.scopeYaml);
  results.push({
    name: "ningún `done` sin evidencia en docs/scope.yaml",
    ok: unproven.length === 0,
    detail: unproven.length > 0 ? `sin evidencia: ${unproven.join(", ")}` : "todas las filas done tienen evidencia",
  });
  return results;
}
