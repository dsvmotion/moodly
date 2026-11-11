// La salida del modelo y la decisión de la revisión. Si se aprueba lo decide una
// comprobación fija (nivel, comprobaciones y configuración), nunca el modelo
// solo: un diff que consiga que el modelo diga «approve» no aprueba nada en el
// nivel 2, ni en el nivel 1 mientras LEVEL1_CAN_APPROVE sea false.

import { MAX_FINDINGS, type Level } from "./config.ts";
import type { CheckResult } from "./checks.ts";

export const SEVERITIES = ["high", "medium", "low"] as const;
export type Severity = (typeof SEVERITIES)[number];
export const VERDICTS = ["approve", "request_changes", "comment"] as const;
export type ModelVerdict = (typeof VERDICTS)[number];

export interface Finding {
  file: string;
  line: number | null;
  severity: Severity;
  evidence: string;
}

export interface ModelOutput {
  verdict: ModelVerdict;
  findings: Finding[];
}

/**
 * La respuesta del modelo, validada. Admite el JSON solo o dentro de un bloque
 * ```json. Devuelve null si no tiene la forma exacta: entonces no se aprueba.
 */
export function parseModelOutput(text: string): ModelOutput | null {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  const raw = (fenced?.[1] ?? text).trim();
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null) return null;
  const { verdict, findings } = value as { verdict?: unknown; findings?: unknown };
  if (typeof verdict !== "string" || !(VERDICTS as readonly string[]).includes(verdict)) return null;
  if (!Array.isArray(findings) || findings.length > MAX_FINDINGS) return null;
  const parsed: Finding[] = [];
  for (const item of findings) {
    if (typeof item !== "object" || item === null) return null;
    const { file, line, severity, evidence } = item as Record<string, unknown>;
    if (typeof file !== "string" || file.length === 0 || file.length > 300) return null;
    if (line !== null && line !== undefined && !(Number.isInteger(line) && (line as number) > 0)) return null;
    if (typeof severity !== "string" || !(SEVERITIES as readonly string[]).includes(severity)) return null;
    if (typeof evidence !== "string" || evidence.length === 0) return null;
    parsed.push({ file, line: (line as number | null | undefined) ?? null, severity: severity as Severity, evidence: evidence.slice(0, 600) });
  }
  // Un «approve» con hallazgos graves no es un approve.
  if (verdict === "approve" && parsed.some((f) => f.severity === "high")) return { verdict: "request_changes", findings: parsed };
  return { verdict: verdict as ModelVerdict, findings: parsed };
}

export type ReviewEvent = "APPROVE" | "REQUEST_CHANGES" | "COMMENT";

export interface Decision {
  event: ReviewEvent;
  why: string;
}

export function decide(input: {
  level: Level;
  checks: readonly CheckResult[];
  /** La salida del modelo; null en el nivel 0 o si no se pudo obtener una válida. */
  model: ModelOutput | null;
  level1CanApprove: boolean;
  /** Filas de docs/scope.yaml que el PR pone en `done`: eso no lo aprueba la Revisora sola. */
  newDone?: readonly string[];
}): Decision {
  const failed = input.checks.filter((check) => !check.ok);
  const decision = decideWithoutDone(input, failed);
  if (decision.event === "APPROVE" && input.newDone && input.newDone.length > 0) {
    return { event: "COMMENT", why: `el PR pone en done ${input.newDone.join(", ")}: lo confirma una sesión Revisora o producto, no la Revisora automática` };
  }
  return decision;
}

function decideWithoutDone(
  input: { level: Level; model: ModelOutput | null; level1CanApprove: boolean },
  failed: readonly CheckResult[],
): Decision {
  if (input.level === 2) {
    return { event: "COMMENT", why: "zona sensible: la Revisora deja su análisis y no aprueba; revisa producto" };
  }
  if (failed.length > 0) {
    return { event: "REQUEST_CHANGES", why: `fallan comprobaciones fijas: ${failed.map((c) => c.name).join("; ")}` };
  }
  if (input.level === 0) return { event: "APPROVE", why: "solo documentación no normativa y las comprobaciones fijas pasan" };
  if (!input.model) return { event: "COMMENT", why: "no hubo una salida válida del modelo: no se aprueba" };
  if (input.model.verdict === "request_changes") return { event: "REQUEST_CHANGES", why: "el modelo pide cambios" };
  if (input.model.verdict === "approve") {
    return input.level1CanApprove
      ? { event: "APPROVE", why: "código corriente, sin hallazgos que bloqueen" }
      : { event: "COMMENT", why: "el nivel 1 todavía no aprueba: falta que el modelo acierte el set de prueba (decisión de producto, 2026-11-10)" };
  }
  return { event: "COMMENT", why: "el modelo deja comentarios sin pedir cambios" };
}
