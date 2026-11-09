// Las conversaciones de prueba con el modelo de verdad, por Vercel AI Gateway
// (MANUAL §12.4). Llama a la red y cuesta dinero: no corre en el CI. Desde la raíz:
//
//   AI_GATEWAY_API_KEY=… pnpm --filter @repo/evals eval:agents [opciones]
//
//   --case <id>       solo ese caso (se puede repetir)
//   --agent <tipo>    solo los de reception o customer
//   --repeat <n>      cada caso n veces (por defecto, 1)
//   --max-eur <x>     tope de gasto de la corrida: se para antes de pasarlo (por defecto, 1)
//   --model <clave>   la clave de modelo para conversar (fast, smart…), para comparar; por defecto, la de plataforma
//   --list            enseña los casos y lo que costaría como mucho, sin llamar a nadie
//
// Un caso de comportamiento que falla se repite hasta 3 corridas en total; si
// no acierta ninguna, bloquea aunque la tasa pase el umbral.
//
// Sale con código 1 si algún set queda por debajo de su umbral, si un caso
// falla en todas sus corridas o si se corta por el tope de gasto, y con 2 si
// falla la vía del modelo (red, gateway): se para y ese turno no puntúa.
import { createGatewayTransport } from "@repo/agent-core";
import { GATEWAY_MODELS } from "@repo/config";
import type { ModelKey } from "@repo/config";
import type { ModelTransport, TransportRequest } from "@repo/agent-core";
import { conversationCases } from "./cases.js";
import { CATEGORIES, CONFIRM_RUNS, alwaysFailing, infrastructureError, runCase, score } from "./runner.js";
import type { CaseRun, ConversationCase } from "./runner.js";

interface Options {
  cases: string[];
  agent: string | null;
  repeat: number;
  maxEur: number;
  list: boolean;
  model: ModelKey | null;
}

function parse(argv: readonly string[]): Options {
  const options: Options = { cases: [], agent: null, repeat: 1, maxEur: 1, list: false, model: null };
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
    else if (arg === "--repeat") options.repeat = Number(value());
    else if (arg === "--max-eur") options.maxEur = Number(value());
    else if (arg === "--list") options.list = true;
    else if (arg === "--model") {
      const key = value();
      if (!Object.keys(GATEWAY_MODELS).includes(key) || key === "embedding") throw new Error(`modelo no válido: ${key} (${Object.keys(GATEWAY_MODELS).join(", ")})`);
      options.model = key as ModelKey;
    }
    else throw new Error(`opción desconocida: ${arg}`);
  }
  if (!Number.isInteger(options.repeat) || options.repeat < 1) throw new Error("--repeat tiene que ser un entero ≥ 1");
  if (!(options.maxEur > 0)) throw new Error("--max-eur tiene que ser > 0");
  return options;
}

function select(options: Options): ConversationCase[] {
  const unknown = options.cases.filter((id) => !conversationCases.some((c) => c.id === id));
  if (unknown.length > 0) throw new Error(`casos desconocidos: ${unknown.join(", ")}`);
  return conversationCases.filter(
    (c) => (options.cases.length === 0 || options.cases.includes(c.id)) && (options.agent === null || c.agent === options.agent),
  );
}

/** Una vía que lleva la cuenta y no deja empezar una llamada que pueda pasar el tope de la corrida. */
function metered(inner: ModelTransport, maxEur: number, spent: { eur: number }): ModelTransport {
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

class RunBudgetError extends Error {
  override name = "RunBudgetError";
}

const out = (line = "") => process.stdout.write(`${line}\n`);

async function main(): Promise<number> {
  const options = parse(process.argv.slice(2));
  const cases = select(options);
  if (options.list) {
    for (const c of cases) out(`${c.id.padEnd(40)} ${c.agent.padEnd(9)} ${c.severity.padEnd(8)} ${CATEGORIES[c.category]}`);
    out(`${cases.length} casos × ${options.repeat}`);
    return 0;
  }
  const apiKey = process.env["AI_GATEWAY_API_KEY"];
  if (!apiKey) throw new Error("falta AI_GATEWAY_API_KEY");

  const spent = { eur: 0 };
  const transport = metered(createGatewayTransport({ apiKey }), options.maxEur, spent);
  const runs: CaseRun[] = [];
  let stopped = false;
  let infrastructure = false;

  /**
   * Corre un caso y lo enseña; false si la corrida se para (y entonces el turno
   * no cuenta): por el tope de gasto o porque falló la vía del modelo.
   */
  async function attempt(c: ConversationCase, label: string): Promise<boolean> {
    const run = await runCase(c, transport, options.model ? { converseModel: options.model } : {});
    const failure = infrastructureError(run);
    if (failure?.includes("RunBudgetError")) {
      out(`· tope de gasto alcanzado (${spent.eur.toFixed(4)} €): se para antes de ${c.id}`);
      stopped = true;
      return false;
    }
    if (failure !== null) {
      out(`· falló la vía del modelo en ${c.id}${label} (${failure}): se para la corrida; ese turno no cuenta`);
      stopped = true;
      infrastructure = true;
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
    for (let n = 1; n <= options.repeat && !stopped; n += 1) {
      if (!(await attempt(c, options.repeat > 1 ? ` #${n}` : ""))) break;
    }
    if (stopped) break;
  }

  // Un caso de comportamiento que no acertó ninguna vez se repite hasta
  // CONFIRM_RUNS corridas: si sigue sin acertar, bloquea; si acierta alguna,
  // cuenta en la tasa como cualquier otro. Repetir nunca convierte un fallo en
  // acierto: todas las corridas cuentan. Los de seguridad no se repiten: un
  // solo fallo ya bloquea.
  if (!stopped) {
    for (const id of alwaysFailing(runs)) {
      const c = cases.find((candidate) => candidate.id === id);
      if (!c || c.severity !== "behavior") continue;
      const done = runs.filter((run) => run.case.id === id).length;
      for (let n = done + 1; n <= CONFIRM_RUNS && !stopped; n += 1) {
        if (!(await attempt(c, ` · confirmación ${n}/${CONFIRM_RUNS}`))) break;
      }
      if (stopped) break;
    }
  }

  const scores = score(runs);
  out();
  for (const [severity, s] of Object.entries(scores)) {
    out(`${severity}: ${s.passed}/${s.runs} (${(s.rate * 100).toFixed(1)} %, umbral ${(s.threshold * 100).toFixed(0)} %) ${s.ok ? "OK" : "POR DEBAJO"}`);
    if (s.alwaysFailing.length > 0) out(`  fallan en todas sus corridas (bloquea): ${s.alwaysFailing.join(", ")}`);
  }
  out(`modelo: ${runs.find((run) => run.model)?.model ?? "—"} · gasto: ${spent.eur.toFixed(4)} €`);
  if (stopped) out("corrida incompleta: no vale como resultado");
  if (infrastructure) return 2;
  return scores.safety.ok && scores.behavior.ok && !stopped ? 0 : 1;
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    process.stderr.write(`${error instanceof Error ? `${error.name}: ${error.message}` : String(error)}\n`);
    process.exitCode = 2;
  },
);
