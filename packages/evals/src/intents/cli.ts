// El set de intenciones con el modelo de verdad, por Vercel AI Gateway (PL-T3,
// #222). Llama a la red y cuesta (céntimos con fast): no corre en el CI. Desde la raíz:
//
//   AI_GATEWAY_API_KEY=… pnpm --filter @repo/evals eval:intents [opciones]
//
//   --case <id>        solo ese mensaje (se puede repetir)
//   --group <grupo>    solo simple, complex o sensitive
//   --repeat <n>       cada mensaje n veces (por defecto, 1; nunca más de 5)
//   --model <clave>    la clave con la que clasifica (por defecto, la de la tarea classify)
//   --max-eur <x>      tope de gasto de la corrida (por defecto, 0,5; nunca más de 2, P-05)
//   --list             enseña el set, sin llamar a nadie
//
// Códigos de salida, como eval:agents:
//   0  pasa los umbrales (sensitive 100 % «other»; complex nunca «simple», 100 %; el resto, ≥ 90 %)
//   1  por debajo de un umbral
//   2  falla la vía del modelo: se para y no puntúa
//   3  se corta por el tope de gasto: la corrida está incompleta
import { createGatewayTransport } from "@repo/agent-core";
import { GATEWAY_MODELS } from "@repo/config";
import type { ModelKey } from "@repo/config";
import { RunBudgetError, metered } from "../conversations/runset.js";
import { INTENT_CASES } from "./set.js";
import type { IntentCase, IntentGroup } from "./set.js";
import { COMPLEX_THRESHOLD, LABEL_THRESHOLD, runIntentSet, scoreIntents } from "./score.js";

const HARD_MAX_EUR = 2;
const HARD_MAX_REPEAT = 5;
const GROUPS: readonly IntentGroup[] = ["simple", "complex", "sensitive"];

export interface IntentOptions {
  cases: string[];
  group: IntentGroup | null;
  repeat: number;
  model: ModelKey | null;
  maxEur: number;
  list: boolean;
}

export function parseIntentArgs(argv: readonly string[]): IntentOptions {
  const options: IntentOptions = { cases: [], group: null, repeat: 1, model: null, maxEur: 0.5, list: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const value = () => {
      const next = argv[i + 1];
      if (next === undefined) throw new Error(`falta el valor de ${arg}`);
      i += 1;
      return next;
    };
    if (arg === "--case") options.cases.push(value());
    else if (arg === "--group") {
      const group = value();
      if (!(GROUPS as readonly string[]).includes(group)) throw new Error(`--group tiene que ser ${GROUPS.join(", ")}: ${group}`);
      options.group = group as IntentGroup;
    } else if (arg === "--repeat") options.repeat = Number(value());
    else if (arg === "--max-eur") options.maxEur = Number(value());
    else if (arg === "--model") {
      const key = value();
      if (!Object.keys(GATEWAY_MODELS).includes(key) || key === "embedding") throw new Error(`modelo no válido: ${key}`);
      options.model = key as ModelKey;
    } else if (arg === "--list") options.list = true;
    else throw new Error(`opción desconocida: ${arg}`);
  }
  if (!Number.isInteger(options.repeat) || options.repeat < 1) throw new Error("--repeat tiene que ser un entero ≥ 1");
  if (options.repeat > HARD_MAX_REPEAT) throw new Error(`--repeat no puede pasar de ${HARD_MAX_REPEAT}`);
  if (!(options.maxEur > 0)) throw new Error("--max-eur tiene que ser > 0");
  if (options.maxEur > HARD_MAX_EUR) throw new Error(`--max-eur no puede pasar de ${HARD_MAX_EUR} € (tope duro)`);
  return options;
}

export function selectIntentCases(options: IntentOptions, all: readonly IntentCase[] = INTENT_CASES): IntentCase[] {
  const unknown = options.cases.filter((id) => !all.some((c) => c.id === id));
  if (unknown.length > 0) throw new Error(`casos desconocidos: ${unknown.join(", ")}`);
  return all.filter((c) => (options.cases.length === 0 || options.cases.includes(c.id)) && (options.group === null || c.group === options.group));
}

const out = (line = "") => process.stdout.write(`${line}\n`);

async function main(): Promise<number> {
  const options = parseIntentArgs(process.argv.slice(2));
  const cases = selectIntentCases(options);
  if (options.list) {
    for (const c of cases) out(`${c.id.padEnd(30)} ${c.group.padEnd(9)} ${(c.kind ?? "").padEnd(11)} ${c.expected.padEnd(13)} «${c.message.replace(/\s+/g, " ")}»`);
    out(`${cases.length} mensajes × ${options.repeat}`);
    return 0;
  }
  const apiKey = process.env["AI_GATEWAY_API_KEY"];
  if (!apiKey) throw new Error("falta AI_GATEWAY_API_KEY");
  const spent = { eur: 0 };
  const transport = metered(createGatewayTransport({ apiKey }), options.maxEur, spent);
  const result = await runIntentSet(cases, transport, { repeat: options.repeat, model: options.model, isBudget: (error) => error instanceof RunBudgetError, out });
  const score = scoreIntents(result.runs);
  out();
  out(`sensitive: ${score.sensitive.passed}/${score.sensitive.runs} «other» (umbral 100 %) ${score.sensitive.ok ? "OK" : "POR DEBAJO"}`);
  for (const failure of score.sensitive.failures) out(`  ✗ ${failure}`);
  out(`complex: ${score.complex.passed}/${score.complex.runs} sin ir por el camino barato (umbral ${(COMPLEX_THRESHOLD * 100).toFixed(0)} %) ${score.complex.ok ? "OK" : "POR DEBAJO"}`);
  for (const failure of score.complex.failures) out(`  ✗ ${failure}`);
  out(`etiquetas: ${score.labels.passed}/${score.labels.runs} (${(score.labels.rate * 100).toFixed(1)} %, umbral ${(LABEL_THRESHOLD * 100).toFixed(0)} %) ${score.labels.ok ? "OK" : "POR DEBAJO"}`);
  for (const failure of score.labels.failures) out(`  ✗ ${failure}`);
  if (score.cheapenedByMistake.length > 0) out(`abaratados sin deber (complex → simple): ${score.cheapenedByMistake.join(", ")}`);
  out(`modelo: ${options.model ?? "el de classify"} · gasto: ${spent.eur.toFixed(4)} €`);
  if (result.stopped) {
    out(`corrida incompleta (${result.stopped.reason} en ${result.stopped.caseId}: ${result.stopped.error}): no vale como resultado`);
    return result.stopped.reason === "budget" ? 3 : 2;
  }
  return score.sensitive.ok && score.complex.ok && score.labels.ok ? 0 : 1;
}

// Solo cuando se ejecuta (node dist/intents/cli.js), no cuando un test importa parseIntentArgs.
if (process.argv[1]?.endsWith("intents/cli.js")) {
  main().then(
    (code) => {
      process.exitCode = code;
    },
    (error: unknown) => {
      process.stderr.write(`${error instanceof Error ? `${error.name}: ${error.message}` : String(error)}\n`);
      process.exitCode = 2;
    },
  );
}
