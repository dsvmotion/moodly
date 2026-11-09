// Las conversaciones de prueba con el modelo de verdad, por Vercel AI Gateway
// (MANUAL §12.4). Llama a la red y cuesta dinero: no corre en el CI. Desde la raíz:
//
//   AI_GATEWAY_API_KEY=… pnpm --filter @repo/evals eval:agents [opciones]
//
//   --case <id>       solo ese caso (se puede repetir)
//   --agent <tipo>    solo los de reception o customer
//   --repeat <n>      cada caso n veces (por defecto, 1)
//   --max-eur <x>     tope de gasto de la corrida: se para antes de pasarlo (por defecto, 1)
//   --list            enseña los casos y lo que costaría como mucho, sin llamar a nadie
//
// Sale con código 1 si algún set queda por debajo de su umbral o si se corta
// por el tope de gasto.
import { createGatewayTransport } from "@repo/agent-core";
import type { ModelTransport, TransportRequest } from "@repo/agent-core";
import { conversationCases } from "./cases.js";
import { CATEGORIES, runCase, score } from "./runner.js";
import type { CaseRun, ConversationCase } from "./runner.js";

interface Options {
  cases: string[];
  agent: string | null;
  repeat: number;
  maxEur: number;
  list: boolean;
}

function parse(argv: readonly string[]): Options {
  const options: Options = { cases: [], agent: null, repeat: 1, maxEur: 1, list: false };
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
  for (const c of cases) {
    for (let attempt = 1; attempt <= options.repeat && !stopped; attempt += 1) {
      const run = await runCase(c, transport);
      // Si el tope de la corrida cortó el turno, ese caso no cuenta.
      if (run.outcome.result.status === "handed_off" && run.outcome.result.error?.includes("RunBudgetError")) {
        out(`· tope de gasto alcanzado (${spent.eur.toFixed(4)} €): se para antes de ${c.id}`);
        stopped = true;
        break;
      }
      runs.push(run);
      const ok = run.failures.length === 0;
      out(`${ok ? "✓" : "✗"} ${c.id}${options.repeat > 1 ? ` #${attempt}` : ""} · ${run.outcome.result.status} · ${run.costEur.toFixed(4)} €`);
      out(`    herramientas: ${run.outcome.calls.map((e) => `${e.skillKey}(${e.status})`).join(", ") || "ninguna"}`);
      out(`    respuesta: ${run.outcome.reply === null ? "—" : `«${run.outcome.reply.replace(/\s+/g, " ")}»`}`);
      for (const failure of run.failures) out(`    ✗ ${failure.check}: ${failure.why}`);
    }
    if (stopped) break;
  }

  const scores = score(runs);
  out();
  for (const [severity, s] of Object.entries(scores)) {
    out(`${severity}: ${s.passed}/${s.runs} (${(s.rate * 100).toFixed(1)} %, umbral ${(s.threshold * 100).toFixed(0)} %) ${s.ok ? "OK" : "POR DEBAJO"}`);
  }
  out(`modelo: ${runs.find((run) => run.model)?.model ?? "—"} · gasto: ${spent.eur.toFixed(4)} €`);
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
