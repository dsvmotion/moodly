import { describe, expect, it } from "vitest";
import { INTENTS, INTENT_INSTRUCTIONS, createFakeTransport, deterministicIntent } from "@repo/agent-core";
import type { Intent, TransportRequest, TransportResponse } from "@repo/agent-core";
import { RunBudgetError } from "../conversations/runset.js";
import { parseIntentArgs, selectIntentCases } from "./cli.js";
import { runIntentSet, scoreIntents } from "./score.js";
import { INTENT_CASES } from "./set.js";

// El set de intenciones del enrutado (PL-T3, #222) con un clasificador falso:
// que el set está bien hecho, que la regla sin modelo nunca se queda un
// mensaje que no es un saludo, y que la puntuación hace lo que dice. Con el
// modelo real: pnpm --filter @repo/evals eval:intents.

const byMessage = new Map(INTENT_CASES.map((c) => [c.message, c]));
const userMessage = (request: TransportRequest) => {
  const last = request.messages.at(-1);
  return last?.role === "user" ? last.content : "";
};
const answer = (text: string): TransportResponse => ({ text, model: "fake/fast", tokensIn: 40, tokensOut: 1, costEur: 0.00001 });
/** Un clasificador que contesta lo que diga `label` para cada mensaje del set. */
const classifier = (label: (message: string) => string) => createFakeTransport({ provider: "fake", respond: (request) => answer(label(userMessage(request))) });

describe("el set de intenciones", () => {
  it("ids únicos, etiquetas válidas y los sensibles siempre «other», de los 4 tipos y al menos 5 de cada", () => {
    expect(new Set(INTENT_CASES.map((c) => c.id)).size).toBe(INTENT_CASES.length);
    for (const c of INTENT_CASES) {
      expect((INTENTS as readonly string[]).includes(c.expected), c.id).toBe(true);
      if (c.group === "simple") expect(c.expected, c.id).not.toBe("other");
      else expect(c.expected, c.id).toBe("other");
      expect(c.kind !== undefined, c.id).toBe(c.group === "sensitive");
    }
    for (const kind of ["medical", "injection", "human", "others-data"] as const) expect(INTENT_CASES.filter((c) => c.kind === kind).length, kind).toBeGreaterThanOrEqual(5);
    for (const label of ["greeting", "opening_hours", "slots"] as const) expect(INTENT_CASES.filter((c) => c.expected === label).length, label).toBeGreaterThanOrEqual(5);
  });

  it("la regla sin modelo solo se queda saludos: ningún sensible ni complex se clasifica sin modelo", () => {
    for (const c of INTENT_CASES.filter((candidate) => candidate.group !== "simple")) expect(deterministicIntent(c.message), c.id).toBeNull();
    for (const c of INTENT_CASES) {
      const rule = deterministicIntent(c.message);
      if (rule !== null) expect(rule, c.id).toBe(c.expected);
    }
  });
});

describe("la puntuación", () => {
  it("un clasificador que acierta todo pasa los dos umbrales; los saludos de la regla no llaman al modelo", async () => {
    const transport = classifier((message) => byMessage.get(message)?.expected ?? "other");
    const result = await runIntentSet(INTENT_CASES, transport, { repeat: 1 });
    const score = scoreIntents(result.runs);
    expect(result.stopped).toBeNull();
    expect(score.sensitive).toMatchObject({ ok: true, rate: 1, failures: [] });
    expect(score.labels).toMatchObject({ ok: true, rate: 1 });
    const byRule = result.runs.filter((run) => run.by === "rule").map((run) => run.case.id);
    expect(byRule).toContain("saludo-hola");
    expect(transport.calls).toHaveLength(INTENT_CASES.length - byRule.length);
    // Cada llamada, con las instrucciones fijas y el mensaje como dato.
    for (const call of transport.calls) expect(call.messages[0]).toEqual({ role: "system", content: INTENT_INSTRUCTIONS, cacheable: true });
  });

  it("un solo sensible por el camino barato bloquea, aunque el resto acierte", async () => {
    const transport = classifier((message) => (message.startsWith("Tomo isotretinoína") ? "slots" : (byMessage.get(message)?.expected ?? "other")));
    const score = scoreIntents((await runIntentSet(INTENT_CASES, transport, { repeat: 1 })).runs);
    expect(score.sensitive.ok).toBe(false);
    expect(score.sensitive.failures).toEqual(["medico-isotretinoina-hueco → slots"]);
    expect(score.labels.ok).toBe(true);
  });

  it("un clasificador que dice «slots» a todo: falla los sensibles, abarata los complex y no llega al 90 %", async () => {
    const score = scoreIntents((await runIntentSet(INTENT_CASES, classifier(() => "slots"), { repeat: 1 })).runs);
    expect(score.sensitive.ok).toBe(false);
    expect(score.labels.ok).toBe(false);
    expect(score.cheapenedByMistake.length).toBe(INTENT_CASES.filter((c) => c.group === "complex").length);
  });

  it("un clasificador que dice «other» a todo pasa los sensibles pero no las etiquetas (no ahorra nada)", async () => {
    const score = scoreIntents((await runIntentSet(INTENT_CASES, classifier(() => "other"), { repeat: 1 })).runs);
    expect(score.sensitive.ok).toBe(true);
    expect(score.labels.ok).toBe(false);
  });

  it("si falla la vía del modelo, classifyIntent cae en «other», pero aquí se para y no cuenta como acierto", async () => {
    const broken = classifier(() => "other");
    broken.generate = () => Promise.reject(new Error("GatewayInternalServerError"));
    const result = await runIntentSet(INTENT_CASES.filter((c) => c.group === "sensitive"), broken, { repeat: 1 });
    expect(result.stopped).toMatchObject({ reason: "infrastructure", caseId: "medico-ampolla" });
    expect(result.runs).toHaveLength(0);
  });

  it("si se llega al tope de gasto, se para como «budget»", async () => {
    const capped = classifier(() => "other");
    capped.generate = () => Promise.reject(new RunBudgetError("pasaría el tope"));
    const result = await runIntentSet(INTENT_CASES, capped, { repeat: 1, isBudget: (error) => error instanceof RunBudgetError });
    expect(result.stopped?.reason).toBe("budget");
  });

  it("--repeat corre cada mensaje n veces y todas las corridas cuentan", async () => {
    let n = 0;
    // Acierta una de cada dos veces en el médico: 1/2 «other» → no llega al 100 %.
    const flaky = classifier((message) => (message.startsWith("Me arde") && (n += 1) % 2 === 0 ? "greeting" : (byMessage.get(message)?.expected ?? "other")));
    const result = await runIntentSet(INTENT_CASES, flaky, { repeat: 2 });
    const mine = result.runs.filter((run) => run.case.id === "medico-me-arde").map((run) => run.intent satisfies Intent);
    expect(mine).toEqual(["other", "greeting"]);
    expect(scoreIntents(result.runs).sensitive.ok).toBe(false);
  });

  it("--model clasifica con esa clave", async () => {
    const transport = classifier((message) => byMessage.get(message)?.expected ?? "other");
    await runIntentSet(INTENT_CASES.slice(0, 3), transport, { repeat: 1, model: "smart" });
    expect(transport.calls.length).toBeGreaterThan(0);
    expect(transport.calls.every((call) => call.modelKey === "smart")).toBe(true);
  });
});

describe("la línea de comandos", () => {
  it("el tope duro (P-05) y los filtros", () => {
    expect(parseIntentArgs([])).toMatchObject({ repeat: 1, maxEur: 0.5, model: null, group: null });
    expect(() => parseIntentArgs(["--max-eur", "2.5"])).toThrow(/tope duro/);
    expect(() => parseIntentArgs(["--repeat", "6"])).toThrow(/no puede pasar de 5/);
    expect(() => parseIntentArgs(["--group", "otros"])).toThrow(/--group/);
    expect(() => parseIntentArgs(["--model", "embedding"])).toThrow(/modelo no válido/);
    expect(selectIntentCases(parseIntentArgs(["--group", "sensitive"])).every((c) => c.group === "sensitive")).toBe(true);
    expect(() => selectIntentCases(parseIntentArgs(["--case", "nope"]))).toThrow(/casos desconocidos/);
  });
});
