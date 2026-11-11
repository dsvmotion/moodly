// La línea base de las evals con el modelo real (K-01): los fallos conocidos,
// cada uno con su motivo. Un fallo conocido se sigue corriendo (una vez, sin
// confirmaciones) para ver cuándo se arregla, pero no puntúa ni bloquea; en
// cuanto acierta, la corrida avisa de que hay que quitarlo de la lista.
//
// Nunca un caso de seguridad: esos tienen que pasar siempre (umbral del 100 %).
// La lista es un archivo del repo (packages/evals/baseline.json): añadir o
// quitar un caso pasa por un PR, con su motivo.
import { readFileSync } from "node:fs";
import { z } from "zod";
import type { CaseRun, ConversationCase } from "./runner.js";

const BaselineSchema = z
  .object({
    knownFailures: z.record(z.string().regex(/^[a-z0-9-]+$/), z.string().trim().min(20, "cada fallo conocido lleva su motivo")),
  })
  .strict();

export interface Baseline {
  /** id del caso → por qué falla y quién lo arregla. */
  knownFailures: Readonly<Record<string, string>>;
}

export const EMPTY_BASELINE: Baseline = { knownFailures: {} };

/** Lee y valida la línea base contra los casos: que existan y que ninguno sea de seguridad. */
export function parseBaseline(raw: unknown, cases: readonly ConversationCase[]): Baseline {
  const baseline = BaselineSchema.parse(raw);
  for (const id of Object.keys(baseline.knownFailures)) {
    const c = cases.find((candidate) => candidate.id === id);
    if (!c) throw new Error(`la línea base nombra un caso que no existe: ${id}`);
    if (c.severity === "safety") throw new Error(`un caso de seguridad no puede ser un fallo conocido: ${id}`);
  }
  return baseline;
}

export function loadBaseline(path: string, cases: readonly ConversationCase[]): Baseline {
  return parseBaseline(JSON.parse(readFileSync(path, "utf8")) as unknown, cases);
}

export interface KnownResult {
  id: string;
  reason: string;
  passed: number;
  runs: number;
}

/** Separa las corridas que puntúan de las de los fallos conocidos. */
export function applyBaseline(runs: readonly CaseRun[], baseline: Baseline): { scored: CaseRun[]; known: KnownResult[] } {
  const isKnown = (id: string) => Object.hasOwn(baseline.knownFailures, id);
  const known = Object.entries(baseline.knownFailures).flatMap(([id, reason]) => {
    const mine = runs.filter((run) => run.case.id === id);
    return mine.length === 0 ? [] : [{ id, reason, runs: mine.length, passed: mine.filter((run) => run.failures.length === 0).length }];
  });
  return { scored: runs.filter((run) => !isKnown(run.case.id)), known };
}
