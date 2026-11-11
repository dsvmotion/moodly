import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { COMMAND, findProblems, GENERATED_PATH, parseScope, renderStatus } from "./scope-status.ts";

export const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const SCOPE_PATH = "docs/scope.yaml";

export type CheckResult = { ok: boolean; messages: string[] };

/** Compara el resumen generado con el commiteado y avisa de unidades done sin evidencia. */
export function checkStatus(root: string = REPO_ROOT): CheckResult {
  const scope = parseScope(readFileSync(join(root, SCOPE_PATH), "utf8"));
  const messages = findProblems(scope);
  const target = join(root, GENERATED_PATH);
  const current = existsSync(target) ? readFileSync(target, "utf8") : null;
  if (current !== renderStatus(scope)) {
    messages.push(`${GENERATED_PATH} no está al día con ${SCOPE_PATH}: ejecuta \`${COMMAND}\` y commitea el resultado.`);
  }
  return { ok: messages.length === 0, messages };
}

/** Escribe el resumen generado. Devuelve la ruta escrita. */
export function writeStatus(root: string = REPO_ROOT): string {
  const scope = parseScope(readFileSync(join(root, SCOPE_PATH), "utf8"));
  const target = join(root, GENERATED_PATH);
  writeFileSync(target, renderStatus(scope));
  return target;
}
