// Corre el set de intenciones contra un clasificador y lo puntúa (PL-T3, #222).
//
// Umbrales:
// - sensitive: el 100 % de las corridas da «other». Uno solo que va por el
//   camino barato bloquea (como un caso de seguridad de las conversaciones).
// - complex: el 100 % de las corridas NO da «simple» (producto, 2026-11-12;
//   tolerancia 0, como los sensibles). Un mensaje complejo que sale como
//   simple abarata un turno que no debía: bloquea aunque el 90 % general pase.
// - el resto (simple y complex): acierta al menos el 90 % de las corridas,
//   como el comportamiento de las conversaciones (decisión de producto,
//   2026-11-09). Un complex que sale como simple se lista aparte: es el error
//   que abarata un turno que no debía.
//
// Si el clasificador no llega a llamar al modelo (fallo de la vía o tope de
// gasto), classifyIntent devuelve «other» por seguridad; aquí eso no puntúa
// como acierto: la corrida se para y no vale como resultado.
import { PLATFORM_MODEL_POLICY, classifyIntent, createModelRouter } from "@repo/agent-core";
import type { Intent, ModelTransport } from "@repo/agent-core";
import type { ModelKey } from "@repo/config";
import type { IntentCase } from "./set.js";

export const SENSITIVE_THRESHOLD = 1;
export const COMPLEX_THRESHOLD = 1;
export const LABEL_THRESHOLD = 0.9;

export interface IntentRun {
  case: IntentCase;
  intent: Intent;
  by: "rule" | "model";
  costEur: number;
}

export interface IntentSetResult {
  runs: IntentRun[];
  /** Por qué se paró antes de acabar: entonces no vale como resultado. */
  stopped: { reason: "infrastructure" | "budget"; caseId: string; error: string } | null;
}

/**
 * Clasifica cada mensaje `repeat` veces con la vía dada, como en el turno
 * (classifyIntent: la regla y, si no, la tarea classify). `isBudget` dice si
 * un error de la vía es el tope de gasto de la corrida.
 */
export async function runIntentSet(
  cases: readonly IntentCase[],
  transport: ModelTransport,
  options: {
    repeat: number;
    /** La clave con la que clasifica, si no es la de la tarea classify (para comparar). */
    model?: ModelKey | null;
    isBudget?: (error: unknown) => boolean;
    out?: (line: string) => void;
  },
): Promise<IntentSetResult> {
  let lastError: unknown;
  const watched: ModelTransport = {
    ...transport,
    async generate(request) {
      try {
        return await transport.generate(request);
      } catch (error) {
        lastError = error;
        throw error;
      }
    },
  };
  const router = createModelRouter([watched]);
  const policy = options.model ? { ...PLATFORM_MODEL_POLICY, modelOverrides: { ...PLATFORM_MODEL_POLICY.modelOverrides, classify: options.model } } : PLATFORM_MODEL_POLICY;
  const runs: IntentRun[] = [];
  for (const c of cases) {
    for (let n = 0; n < options.repeat; n += 1) {
      lastError = null;
      const result = await classifyIntent({ organizationId: "org-evals", runId: `intent-${c.id}-${n}`, message: c.message, router, policy, spend: { runEur: 0, dayEur: 0, monthEur: 0 } });
      if (result.by === "fallback") {
        const error = lastError ?? new Error("classifyIntent devolvió «other» sin llamar al modelo");
        const reason = options.isBudget?.(error) ? "budget" : "infrastructure";
        return { runs, stopped: { reason, caseId: c.id, error: error instanceof Error ? `${error.name}: ${error.message}` : String(error) } };
      }
      const run: IntentRun = { case: c, intent: result.intent, by: result.by, costEur: result.usage?.costEur ?? 0 };
      runs.push(run);
      options.out?.(`${run.intent === c.expected ? "✓" : "✗"} ${c.id.padEnd(30)} ${c.group.padEnd(9)} esperado ${c.expected.padEnd(13)} salió ${run.intent.padEnd(13)} (${run.by})`);
    }
  }
  return { runs, stopped: null };
}

export interface IntentScore {
  sensitive: { passed: number; runs: number; rate: number; ok: boolean; failures: string[] };
  /** Los complex nunca van por el camino barato: «simple» es cualquier etiqueta que no es «other». */
  complex: { passed: number; runs: number; rate: number; ok: boolean; failures: string[] };
  labels: { passed: number; runs: number; rate: number; ok: boolean; failures: string[] };
  /** Los complex que salieron como simples: el turno se habría abaratado sin deber. */
  cheapenedByMistake: string[];
  costEur: number;
}

export function scoreIntents(runs: readonly IntentRun[]): IntentScore {
  const tag = (run: IntentRun) => `${run.case.id} → ${run.intent}`;
  const sensitive = runs.filter((run) => run.case.group === "sensitive");
  const complex = runs.filter((run) => run.case.group === "complex");
  const complexPassed = complex.filter((run) => run.intent === "other");
  const rest = runs.filter((run) => run.case.group !== "sensitive");
  const sensitivePassed = sensitive.filter((run) => run.intent === "other");
  const restPassed = rest.filter((run) => run.intent === run.case.expected);
  const rate = (passed: number, total: number) => (total === 0 ? 1 : passed / total);
  return {
    sensitive: {
      passed: sensitivePassed.length,
      runs: sensitive.length,
      rate: rate(sensitivePassed.length, sensitive.length),
      ok: rate(sensitivePassed.length, sensitive.length) >= SENSITIVE_THRESHOLD,
      failures: sensitive.filter((run) => run.intent !== "other").map(tag),
    },
    complex: {
      passed: complexPassed.length,
      runs: complex.length,
      rate: rate(complexPassed.length, complex.length),
      ok: rate(complexPassed.length, complex.length) >= COMPLEX_THRESHOLD,
      failures: complex.filter((run) => run.intent !== "other").map(tag),
    },
    labels: {
      passed: restPassed.length,
      runs: rest.length,
      rate: rate(restPassed.length, rest.length),
      ok: rate(restPassed.length, rest.length) >= LABEL_THRESHOLD,
      failures: rest.filter((run) => run.intent !== run.case.expected).map(tag),
    },
    cheapenedByMistake: rest.filter((run) => run.case.group === "complex" && run.intent !== "other").map(tag),
    costEur: runs.reduce((sum, run) => sum + run.costEur, 0),
  };
}
