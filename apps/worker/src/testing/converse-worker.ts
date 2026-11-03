// Proceso de prueba para agents/converse.integration.ts: el worker real con el
// consumidor agent.converse y un modelo falso con guion, que apunta en un
// archivo (una línea JSON) qué vio en cada llamada.
//
//   CONVERSE_PLAN='{"serviceId":…,"resourceId":…,"startsAt":…}' node converse-worker.ts <archivo>
//
// El guion: si el cliente pide reservar, propone book_appointment; si pregunta
// por huecos, find_slots, con el service_id que lee del prompt (como un modelo
// real: si los servicios no llegan al prompt, no hay hueco que buscar); con el resultado de una herramienta, contesta según
// se hizo o queda para una persona; ante una duda médica, no dice nada (el
// turno pasa a una persona); si no, saluda.
import { appendFileSync } from "node:fs";
import { createFakeTransport, createModelRouter } from "@repo/agent-core";
import type { TransportRequest, TransportResponse } from "@repo/agent-core";
import { createConverseHandler } from "../agents/converse.ts";
import { loadConfig } from "../config.ts";
import { logHandler } from "../events/log-handler.ts";
import { createLogger } from "../logger.ts";
import { createWorker } from "../worker.ts";

const [effectsFile] = process.argv.slice(2);
if (!effectsFile) throw new Error("uso: converse-worker.ts <archivo>");
const plan = JSON.parse(process.env["CONVERSE_PLAN"] ?? "{}") as { serviceId: string; resourceId: string; startsAt: string };

function effect(record: Record<string, unknown>): void {
  appendFileSync(effectsFile as string, `${JSON.stringify({ ...record, pid: process.pid })}\n`);
}

const usage = { model: "fake/fast", tokensIn: 120, tokensOut: 30, costEur: 0.0004 };
const say = (text: string): TransportResponse => ({ text, ...usage });
const call = (name: string, args: Record<string, unknown>): TransportResponse => ({
  text: "",
  toolCalls: [{ id: `call-${name}`, name, args }],
  ...usage,
});

/** El service_id de un servicio por su nombre, de la capa «What can be booked» del prompt. */
function serviceIdFromPrompt(system: string | null, name: string): string {
  return new RegExp(`^- ${name} \\(\\d+ min\\): service_id (\\S+)$`, "m").exec(system ?? "")?.[1] ?? "no-esta-en-el-prompt";
}

function respond(request: TransportRequest): TransportResponse {
  const last = request.messages.at(-1);
  const system = request.messages[0]?.role === "system" ? request.messages[0].content : null;
  const customer = [...request.messages].reverse().find((message) => message.role === "user")?.content ?? "";
  effect({
    step: "model",
    tools: (request.tools ?? []).map((tool) => tool.name),
    lastRole: last?.role,
    customer,
    system: request.messages[0]?.role === "system" ? request.messages[0].content : null,
  });
  if (last?.role === "tool") {
    const result = JSON.parse(last.content) as { status: string };
    return say(result.status === "executed" ? "Tengo hueco el lunes a las 9:00." : "Una persona del equipo te lo confirma enseguida.");
  }
  if (/res[eé]rv/i.test(customer)) {
    return call("book_appointment", { service_id: plan.serviceId, resource_id: plan.resourceId, starts_at: plan.startsAt });
  }
  if (/hueco/i.test(customer)) return call("find_slots", { service_id: serviceIdFromPrompt(system, "Láser"), from: "2030-06-03T00:00:00+02:00" });
  // Una respuesta vacía: el turno pasa la conversación a una persona.
  if (/médic/i.test(customer)) return say("   ");
  return say("Hola, soy el asistente de IA del centro.");
}

const config = loadConfig(process.env);
const logger = createLogger(config.logLevel);
const router = createModelRouter([createFakeTransport({ provider: "fake", respond })]);
const worker = createWorker(config, logger, {
  eventHandlers: [logHandler, createConverseHandler({ router })],
  onLeaseLost: (err) => {
    logger.fatal({ err }, "se perdió el lock del executor");
    process.exit(1);
  },
});
process.on("SIGTERM", () => {
  void worker.stop().then(() => process.exit(0));
});
await worker.start();
effect({ step: "started" });
