// Una corrida de un set de casos con un modelo, y la comparación de varias
// (B-01: cada agente conversa con el modelo más barato que pasa sus evals).
// Lo usa cli.ts con el modelo real; los tests, con el falso.
import type { ModelKey } from "@repo/config";
import type { ModelTransport, TransportRequest } from "@repo/agent-core";
import { CONFIRM_RUNS, alwaysFailing, infrastructureError, runCase, score } from "./runner.js";
import type { CaseRun, ConversationCase, Score, Severity } from "./runner.js";

/** Una vía que lleva la cuenta y no deja empezar una llamada que pueda pasar el tope de la corrida. */
export function metered(inner: ModelTransport, maxEur: number, spent: { eur: number }): ModelTransport {
  return {
    ...inner,
    estimateEur: (request: TransportRequest) => inner.estimateEur(request),
    async generate(request) {
      const estimate = inner.estimateEur(request);
      if (spent.eur + estimate > maxEur) throw new RunBudgetError(`la siguiente llamada (hasta ${estimate.toFixed(4)} €) pasaría el tope de ${maxEur} €`);
      const response = await inner.generate(request);
      spent.eur += response.costEur;
      return response;
    },
  };
}

export class RunBudgetError extends Error {
  override name = "RunBudgetError";
}

/** Los casos de varios turnos: la conversación ya trae algo antes del último mensaje. */
export const isMultiTurn = (c: ConversationCase) => c.history.length > 1;

export interface SetOptions {
  repeat: number;
  /** La clave con la que conversa el agente; null = la de cada agente. */
  model: ModelKey | null;
  /** La vía del modelo; sin ella, el guion de cada caso (modelo falso). */
  transport?: ModelTransport;
  out: (line?: string) => void;
  /** Los fallos conocidos de la línea base: corren una vez, sin confirmaciones (no puntúan). */
  known?: ReadonlySet<string>;
}

export interface SetResult {
  model: ModelKey | null;
  runs: CaseRun[];
  /** Por qué se paró antes de acabar, si se paró: entonces no vale como resultado. */
  stopped: "budget" | "infrastructure" | null;
}

/**
 * Corre los casos `repeat` veces cada uno y enseña cada corrida. Un caso de
 * comportamiento que no acertó ninguna vez se repite hasta CONFIRM_RUNS
 * corridas: si sigue sin acertar, bloquea; si acierta alguna, cuenta en la
 * tasa como cualquier otro. Repetir nunca convierte un fallo en acierto: todas
 * las corridas cuentan. Los de seguridad no se repiten: un solo fallo ya
 * bloquea. Si falla la vía del modelo o se llega al tope de gasto, se para y
 * ese turno no puntúa.
 */
export async function runSet(cases: readonly ConversationCase[], options: SetOptions): Promise<SetResult> {
  const { out } = options;
  const runs: CaseRun[] = [];
  let stopped: SetResult["stopped"] = null;

  async function attempt(c: ConversationCase, label: string): Promise<boolean> {
    const run = await runCase(c, options.transport, options.model ? { converseModel: options.model } : {});
    const failure = infrastructureError(run);
    if (failure?.includes("RunBudgetError")) {
      out(`· tope de gasto alcanzado: se para antes de ${c.id}`);
      stopped = "budget";
      return false;
    }
    if (failure !== null) {
      out(`· falló la vía del modelo en ${c.id}${label} (${failure}): se para la corrida; ese turno no cuenta`);
      stopped = "infrastructure";
      return false;
    }
    runs.push(run);
    const ok = run.failures.length === 0;
    out(`${ok ? "✓" : "✗"} ${c.id}${label} · ${run.outcome.result.status} · ${run.costEur.toFixed(4)} €`);
    out(`    herramientas: ${run.outcome.calls.map((e) => `${e.skillKey}(${e.status})`).join(", ") || "ninguna"}`);
    out(`    respuesta: ${run.outcome.reply === null ? "—" : `«${run.outcome.reply.replace(/\s+/g, " ")}»`}`);
    for (const failure of run.failures) out(`    ✗ ${failure.check}: ${failure.why}`);
    return true;
  }

  for (const c of cases) {
    for (let n = 1; n <= options.repeat && stopped === null; n += 1) {
      if (!(await attempt(c, options.repeat > 1 ? ` #${n}` : ""))) break;
    }
    if (stopped !== null) break;
  }

  if (stopped === null) {
    for (const id of alwaysFailing(runs)) {
      const c = cases.find((candidate) => candidate.id === id);
      if (!c || c.severity !== "behavior" || options.known?.has(id)) continue;
      const done = runs.filter((run) => run.case.id === id).length;
      for (let n = done + 1; n <= CONFIRM_RUNS && stopped === null; n += 1) {
        if (!(await attempt(c, ` · confirmación ${n}/${CONFIRM_RUNS}`))) break;
      }
      if (stopped !== null) break;
    }
  }

  return { model: options.model, runs, stopped };
}

export interface SetSummary {
  model: string;
  scores: Record<Severity, Score>;
  costEur: number;
  /** Lo que costó de media cada corrida de un caso. */
  eurPerRun: number;
  complete: boolean;
}

export function summarize(result: SetResult): SetSummary {
  const costEur = result.runs.reduce((sum, run) => sum + run.costEur, 0);
  const models = [...new Set(result.runs.flatMap((run) => (run.model ? [run.model] : [])))];
  return {
    model: result.model ?? (models.join(", ") || "la de cada agente"),
    scores: score(result.runs),
    costEur,
    eurPerRun: result.runs.length === 0 ? 0 : costEur / result.runs.length,
    complete: result.stopped === null,
  };
}

const pct = (s: Score) => `${s.passed}/${s.runs} (${(s.rate * 100).toFixed(0)} %)`;

/**
 * La tabla para decidir: por modelo, seguridad, comportamiento, los casos que
 * fallan siempre y el coste; y por caso, cuántas corridas acertó con cada uno.
 */
export function comparisonTable(results: readonly SetResult[]): string[] {
  const summaries = results.map(summarize);
  const lines: string[] = [];
  lines.push("== Comparación");
  lines.push(`${"modelo".padEnd(10)} ${"seguridad".padEnd(14)} ${"comportamiento".padEnd(16)} ${"€/corrida".padEnd(10)} ${"gasto".padEnd(9)} pasa`);
  for (const s of summaries) {
    const passes = s.complete && s.scores.safety.ok && s.scores.behavior.ok;
    lines.push(
      `${s.model.padEnd(10)} ${pct(s.scores.safety).padEnd(14)} ${pct(s.scores.behavior).padEnd(16)} ${s.eurPerRun.toFixed(4).padEnd(10)} ${s.costEur.toFixed(2).padEnd(9)} ${s.complete ? (passes ? "sí" : "no") : "incompleta"}`,
    );
    const failing = [...s.scores.safety.alwaysFailing, ...s.scores.behavior.alwaysFailing];
    if (failing.length > 0) lines.push(`${"".padEnd(10)} fallan siempre: ${failing.join(", ")}`);
  }

  // Por caso: aciertos/corridas con cada modelo; solo los que no aciertan siempre con todos.
  const ids = [...new Set(results.flatMap((result) => result.runs.map((run) => run.case.id)))];
  const cell = (result: SetResult, id: string) => {
    const mine = result.runs.filter((run) => run.case.id === id);
    return mine.length === 0 ? "—" : `${mine.filter((run) => run.failures.length === 0).length}/${mine.length}`;
  };
  const mixed = ids.filter((id) => results.some((result) => {
    const mine = result.runs.filter((run) => run.case.id === id);
    return mine.length === 0 || mine.some((run) => run.failures.length > 0);
  }));
  if (mixed.length > 0) {
    lines.push("");
    lines.push(`${"caso".padEnd(42)} ${summaries.map((s) => s.model.padEnd(10)).join(" ")}`);
    for (const id of mixed) lines.push(`${id.padEnd(42)} ${results.map((result) => cell(result, id).padEnd(10)).join(" ")}`);
  } else if (ids.length > 0) {
    lines.push("");
    lines.push("todos los casos aciertan en todas sus corridas con todos los modelos");
  }
  return lines;
}
