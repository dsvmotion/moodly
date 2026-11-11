// Las conversaciones de prueba con el modelo de verdad, por Vercel AI Gateway
// (MANUAL §12.4). Llama a la red y cuesta dinero: no corre en el CI. Desde la raíz:
//
//   AI_GATEWAY_API_KEY=… pnpm --filter @repo/evals eval:agents [opciones]
//
//   --case <id>         solo ese caso (se puede repetir)
//   --agent <tipo>      solo los de reception o customer
//   --turns <n>         solo los de un turno (single) o los de varios (multi)
//   --repeat <n>        cada caso n veces (por defecto, 1)
//   --max-eur <x>       tope de gasto de toda la corrida: se para antes de pasarlo (por defecto, 1)
//   --model <clave>     la clave de modelo para conversar (fast, smart…); por defecto, la de cada agente (MANUAL §5.11)
//   --compare <claves>  corre los mismos casos con cada clave (p. ej. fast,balanced,smart) y saca la tabla para elegir (B-01)
//   --list              enseña los casos (y los precios de cada clave a comparar), sin llamar a nadie
//
// Un caso de comportamiento que falla se repite hasta 3 corridas en total; si
// no acierta ninguna, bloquea aunque la tasa pase el umbral.
//
// Sale con código 1 si algún set queda por debajo de su umbral, si un caso
// falla en todas sus corridas o si se corta por el tope de gasto, y con 2 si
// falla la vía del modelo (red, gateway): se para y ese turno no puntúa. Con
// --compare, el código no depende de si cada modelo pasa (es para elegir): 1 si
// se corta por el tope, 2 si falla la vía del modelo, 0 si no.
import { createGatewayTransport } from "@repo/agent-core";
import { GATEWAY_MODELS } from "@repo/config";
import type { ModelKey } from "@repo/config";
import { conversationCases } from "./cases.js";
import { CATEGORIES } from "./runner.js";
import type { ConversationCase } from "./runner.js";
import { comparisonTable, isMultiTurn, metered, runSet, summarize } from "./runset.js";
import type { SetResult } from "./runset.js";

interface Options {
  cases: string[];
  agent: string | null;
  turns: "single" | "multi" | null;
  repeat: number;
  maxEur: number;
  list: boolean;
  model: ModelKey | null;
  compare: ModelKey[];
}

/** Una clave de modelo para conversar: cualquiera de GATEWAY_MODELS menos la de embeddings. */
function modelKey(key: string): ModelKey {
  if (!Object.keys(GATEWAY_MODELS).includes(key) || key === "embedding") {
    throw new Error(`modelo no válido: ${key} (${Object.keys(GATEWAY_MODELS).filter((k) => k !== "embedding").join(", ")})`);
  }
  return key as ModelKey;
}

export function parse(argv: readonly string[]): Options {
  const options: Options = { cases: [], agent: null, turns: null, repeat: 1, maxEur: 1, list: false, model: null, compare: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const value = () => {
      const next = argv[i + 1];
      if (next === undefined) throw new Error(`falta el valor de ${arg}`);
      i += 1;
      return next;
    };
    if (arg === "--case") options.cases.push(value());
    else if (arg === "--agent") options.agent = value();
    else if (arg === "--turns") {
      const turns = value();
      if (turns !== "single" && turns !== "multi") throw new Error(`--turns tiene que ser single o multi: ${turns}`);
      options.turns = turns;
    } else if (arg === "--repeat") options.repeat = Number(value());
    else if (arg === "--max-eur") options.maxEur = Number(value());
    else if (arg === "--list") options.list = true;
    else if (arg === "--model") options.model = modelKey(value());
    else if (arg === "--compare") options.compare = value().split(",").map((key) => modelKey(key.trim()));
    else throw new Error(`opción desconocida: ${arg}`);
  }
  if (!Number.isInteger(options.repeat) || options.repeat < 1) throw new Error("--repeat tiene que ser un entero ≥ 1");
  if (!(options.maxEur > 0)) throw new Error("--max-eur tiene que ser > 0");
  if (options.model !== null && options.compare.length > 0) throw new Error("--model y --compare no van juntos");
  if (new Set(options.compare).size !== options.compare.length) throw new Error("--compare repite una clave");
  return options;
}

export function select(options: Options, all: readonly ConversationCase[] = conversationCases): ConversationCase[] {
  const unknown = options.cases.filter((id) => !all.some((c) => c.id === id));
  if (unknown.length > 0) throw new Error(`casos desconocidos: ${unknown.join(", ")}`);
  return all.filter(
    (c) =>
      (options.cases.length === 0 || options.cases.includes(c.id)) &&
      (options.agent === null || c.agent === options.agent) &&
      (options.turns === null || (options.turns === "multi") === isMultiTurn(c)),
  );
}

const out = (line = "") => process.stdout.write(`${line}\n`);

async function main(): Promise<number> {
  const options = parse(process.argv.slice(2));
  const cases = select(options);
  if (options.list) {
    for (const c of cases) out(`${c.id.padEnd(40)} ${(c.business?.key ?? "estetica").padEnd(12)} ${c.agent.padEnd(9)} ${c.severity.padEnd(8)} ${isMultiTurn(c) ? "varios " : "un turno"} ${CATEGORIES[c.category]}`);
    out(`${cases.length} casos × ${options.repeat}${options.compare.length > 0 ? ` × ${options.compare.length} modelos` : ""}`);
    for (const key of options.compare) {
      const model = GATEWAY_MODELS[key];
      if (model) out(`  ${key.padEnd(10)} ${model.id} · ${model.inputUsdPerMTok} $/MTok de entrada, ${model.outputUsdPerMTok} $/MTok de salida`);
    }
    return 0;
  }
  const apiKey = process.env["AI_GATEWAY_API_KEY"];
  if (!apiKey) throw new Error("falta AI_GATEWAY_API_KEY");

  // Un solo tope para toda la corrida, también cuando compara varios modelos.
  const spent = { eur: 0 };
  const transport = metered(createGatewayTransport({ apiKey }), options.maxEur, spent);

  if (options.compare.length > 0) {
    const results: SetResult[] = [];
    for (const model of options.compare) {
      out(`== ${model} (${GATEWAY_MODELS[model]?.id ?? "?"})`);
      const result = await runSet(cases, { repeat: options.repeat, model, transport, out });
      results.push(result);
      if (result.stopped !== null) break;
    }
    out();
    for (const line of comparisonTable(results)) out(line);
    out(`gasto total: ${spent.eur.toFixed(4)} €`);
    const stopped = results.find((result) => result.stopped !== null)?.stopped ?? null;
    if (stopped !== null) out("comparación incompleta: no vale como resultado");
    return stopped === "infrastructure" ? 2 : stopped === "budget" ? 1 : 0;
  }

  const result = await runSet(cases, { repeat: options.repeat, model: options.model, transport, out });
  const summary = summarize(result);
  out();
  for (const [severity, s] of Object.entries(summary.scores)) {
    out(`${severity}: ${s.passed}/${s.runs} (${(s.rate * 100).toFixed(1)} %, umbral ${(s.threshold * 100).toFixed(0)} %) ${s.ok ? "OK" : "POR DEBAJO"}`);
    if (s.alwaysFailing.length > 0) out(`  fallan en todas sus corridas (bloquea): ${s.alwaysFailing.join(", ")}`);
  }
  // Cada agente conversa con su modelo: con casos de varios agentes salen todos.
  const models = [...new Set(result.runs.flatMap((run) => (run.model ? [run.model] : [])))];
  out(`modelo: ${models.join(", ") || "—"} · gasto: ${spent.eur.toFixed(4)} €`);
  if (result.stopped !== null) out("corrida incompleta: no vale como resultado");
  if (result.stopped === "infrastructure") return 2;
  return summary.scores.safety.ok && summary.scores.behavior.ok && result.stopped === null ? 0 : 1;
}

// Solo cuando se ejecuta (node dist/conversations/cli.js), no cuando un test importa parse/select.
if (process.argv[1]?.endsWith("cli.js")) {
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
