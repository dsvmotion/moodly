import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { findProblems, parseScope, renderStatus, ScopeParseError } from "./scope-status.ts";

export const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const SCOPE_PATH = "docs/scope.yaml";

export type CheckResult = { ok: boolean; messages: string[] };

/** Valida docs/scope.yaml: se lee entero, sin ids repetidos, y ninguna unidad done sin evidencia. */
export function validateScope(root: string = REPO_ROOT): CheckResult {
  try {
    const messages = findProblems(parseScope(readFileSync(join(root, SCOPE_PATH), "utf8")));
    return { ok: messages.length === 0, messages };
  } catch (e) {
    if (e instanceof ScopeParseError) return { ok: false, messages: [`${SCOPE_PATH}: ${e.message}`] };
    throw e;
  }
}

/** Resumen en Markdown del registro (no se commitea). */
export function summary(root: string = REPO_ROOT): string {
  return renderStatus(parseScope(readFileSync(join(root, SCOPE_PATH), "utf8")));
}

export function writeSummary(file: string, root: string = REPO_ROOT): void {
  writeFileSync(file, summary(root));
}
