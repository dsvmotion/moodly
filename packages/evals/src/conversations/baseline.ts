// La línea base de las evals con el modelo real (K-01): los fallos conocidos,
// cada uno con su motivo y dónde se sigue (un issue o un PR).
//
// No cambia la puntuación: un fallo conocido corre, se confirma con 3 corridas
// y bloquea como cualquier otro caso (regla de producto, 2026-11-09). Lo único
// que cambia es cómo se cuenta el rojo: si la corrida solo queda por debajo del
// umbral por fallos conocidos, lo dice (código 4 en vez de 1), y el issue «evals
// en rojo» de main lo explica así en vez de como una regresión. Añadir un caso
// aquí nunca convierte un rojo en verde.
//
// Nunca un caso de seguridad. La lista es un archivo del repo
// (packages/evals/baseline.json): añadir o quitar un caso pasa por un PR.
import { readFileSync } from "node:fs";
import { z } from "zod";
import { score } from "./runner.js";
import type { CaseRun, ConversationCase } from "./runner.js";

const KnownFailureSchema = z
  .object({
    reason: z.string().trim().min(20, "cada fallo conocido lleva su motivo"),
    /** Dónde se sigue el arreglo: «#123» o la URL de un issue o un PR. */
    tracking: z.string().regex(/^(?:#\d+|https:\/\/github\.com\/\S+\/(?:issues|pull)\/\d+)$/, "cada fallo conocido lleva su issue o su PR (#123 o la URL)"),
  })
  .strict();

const BaselineSchema = z
  .object({
    knownFailures: z.record(z.string().regex(/^[a-z0-9-]+$/), KnownFailureSchema),
  })
  .strict();

export type KnownFailure = z.infer<typeof KnownFailureSchema>;

export interface Baseline {
  /** id del caso → por qué falla y dónde se sigue el arreglo. */
  knownFailures: Readonly<Record<string, KnownFailure>>;
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

export interface KnownResult extends KnownFailure {
  id: string;
  passed: number;
  runs: number;
}

export interface BaselineReading {
  /** Los fallos conocidos que corrieron, con sus aciertos. */
  known: KnownResult[];
  /**
   * La corrida no pasa, pero solo por fallos conocidos: sin ellos pasaría y
   * todos los casos que fallan siempre están en la línea base. Sigue siendo
   * rojo; solo cambia cómo se cuenta.
   */
  onlyKnown: boolean;
}

/** Lee una corrida con la línea base. No cambia la puntuación: la de `score(runs)` es la que vale. */
export function readWithBaseline(runs: readonly CaseRun[], baseline: Baseline): BaselineReading {
  const isKnown = (id: string) => Object.hasOwn(baseline.knownFailures, id);
  const known = Object.entries(baseline.knownFailures).flatMap(([id, failure]) => {
    const mine = runs.filter((run) => run.case.id === id);
    return mine.length === 0 ? [] : [{ id, ...failure, runs: mine.length, passed: mine.filter((run) => run.failures.length === 0).length }];
  });
  const all = score(runs);
  const red = !all.safety.ok || !all.behavior.ok;
  const without = score(runs.filter((run) => !isKnown(run.case.id)));
  const failing = [...all.safety.alwaysFailing, ...all.behavior.alwaysFailing];
  const onlyKnown = red && without.safety.ok && without.behavior.ok && failing.every(isKnown);
  return { known, onlyKnown };
}
