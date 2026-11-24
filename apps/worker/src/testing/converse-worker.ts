// Proceso de prueba para agents/converse.integration.ts: el worker real con el
// consumidor agent.converse y un modelo falso con guion, que apunta en un
// archivo (una línea JSON) qué vio en cada llamada.
//
//   CONVERSE_PLAN='{"serviceId":…,"resourceId":…,"startsAt":…}' node converse-worker.ts <archivo>
//
// El guion: si el cliente pide reservar, propone book_appointment; si pregunta
// por huecos, find_slots, con el service_id que lee del prompt (como un modelo
// real: si los servicios no llegan al prompt, no hay hueco que buscar); si
// pregunta un precio o una política, search_knowledge con su pregunta; con el
// resultado de una herramienta, contesta según se hizo o queda para una
// persona (y con lo que encontró en el conocimiento, el primer fragmento, o que
// le contestará una persona); ante una duda médica, no dice nada (el turno pasa
// a una persona); si pide hablar con una persona, request_human (CU3); si no,
// saluda.
//
// Si la llamada es la del resumen continuo (PL-T3), lo apunta como «summary» y
// contesta con un resumen que dice cuántos mensajes del cliente resumió.
//
// Si el cliente pide «un momento», el modelo se queda pensando hasta que exista
// <archivo>.gate (lo crea el test después de tomar el control, R-02) y luego
// contesta como siempre; si además pidió reservar, primero reserva y se queda
// pensando con el resultado (gate M1: un turno que ya hizo algo y queda relevado);
// si pidió hablar con una persona, se queda pensando antes de llamar a request_human.
//
// Si pregunta «¿y mi cita?», hace lo que haría un modelo razonable: si el
// prompt dice que hay una reserva pendiente del equipo, lo dice; si no, mira
// sus citas (list_my_appointments) y, si no tiene ninguna, la reserva. Así, si
// lo que hizo un turno anterior no le llegara, reservaría otra vez.
//
// El conocimiento, con embeddings falsos y deterministas: el mismo worker
// indexa las fuentes (knowledge.ingest) y el agente busca en ellas, por una vía
// como la del gateway (sin región UE garantizada).
//
// El calendario conectado (O-02), con la plataforma de conectores falsa y una
// conexión fija (CALENDAR_CONNECTION_ID): sus eventos salen de <archivo>.busy
// (la respuesta de Google tal cual) y cada lectura se apunta como «calendar».
// Sin fila de integración en la base de datos, no se lee nunca. <archivo>.plan,
// si existe, sustituye a CONVERSE_PLAN (la hora que propone reservar).
import { appendFileSync, existsSync, readFileSync, rmSync } from "node:fs";
import { SUMMARY_INSTRUCTIONS, SUMMARY_MARK, createFakeTransport, createModelRouter } from "@repo/agent-core";
import type { RouteOrigin, TransportRequest, TransportResponse } from "@repo/agent-core";
import { createFakeConnectorPlatform } from "@repo/integrations";
import { createFakeEmbedder } from "@repo/knowledge";
import { createApprovalHandler } from "../agents/approvals.ts";
import { codeSkills, createConverseHandler } from "../agents/converse.ts";
import { loadConfig } from "../config.ts";
import { logHandler } from "../events/log-handler.ts";
import { createIngestHandler } from "../knowledge/ingest.ts";
import { createLogger } from "../logger.ts";
import { createWorker } from "../worker.ts";

const [effectsFile] = process.argv.slice(2);
if (!effectsFile) throw new Error("uso: converse-worker.ts <archivo>");
type Plan = { serviceId: string; resourceId: string; startsAt: string };
const envPlan = JSON.parse(process.env["CONVERSE_PLAN"] ?? "{}") as Plan;
const planFile = `${effectsFile}.plan`;
const currentPlan = (): Plan => (existsSync(planFile) ? (JSON.parse(readFileSync(planFile, "utf8")) as Plan) : envPlan);

/** La conexión del calendario conectado de las pruebas (la fila la crea el test, con este mismo id). */
const CALENDAR_CONNECTION_ID = "conn-calendario-pruebas";
const busyFile = `${effectsFile}.busy`;
const platform = createFakeConnectorPlatform({
  proxyResponse: (request) => {
    effect({ step: "calendar", path: request.path });
    return existsSync(busyFile) ? (JSON.parse(readFileSync(busyFile, "utf8")) as unknown) : { items: [] };
  },
});
platform.addConnection({ connectionId: CALENDAR_CONNECTION_ID, integrationKey: "google-calendar", tags: {} });

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
  // «(30 min)», o con el precio de Ajustes (OA04): «(30 min, 45,00 €)».
  return new RegExp(`^- ${name} \\(\\d+ min(?:, [^)]*)?\\): service_id (\\S+)$`, "m").exec(system ?? "")?.[1] ?? "no-esta-en-el-prompt";
}

/** Espera a que el test abra la puerta (R-02): mientras, el turno está a medias. */
async function gated(response: TransportResponse): Promise<TransportResponse> {
  const gate = `${effectsFile as string}.gate`;
  effect({ step: "gate" });
  while (!existsSync(gate)) await new Promise((resolve) => setTimeout(resolve, 50));
  rmSync(gate, { force: true });
  return response;
}

function respond(request: TransportRequest): TransportResponse | Promise<TransportResponse> {
  // El resumen continuo (PL-T3): otra llamada, con sus instrucciones fijas; se apunta aparte.
  if (request.messages[0]?.content === SUMMARY_INSTRUCTIONS) {
    const input = request.messages[1]?.content ?? "";
    effect({ step: "summary", modelKey: request.modelKey, input });
    const { messages } = JSON.parse(input) as { messages: { speaker: string }[] };
    return say(`Customer said: ${messages.filter((message) => message.speaker === "contact").length} mensajes.`);
  }
  const last = request.messages.at(-1);
  const system = request.messages[0]?.role === "system" ? request.messages[0].content : null;
  const customer = [...request.messages].reverse().find((message) => message.role === "user")?.content ?? "";
  effect({
    step: "model",
    tools: (request.tools ?? []).map((tool) => tool.name),
    lastRole: last?.role,
    customer,
    system: request.messages[0]?.role === "system" ? request.messages[0].content : null,
    // La parte del prompt que cambia en cada turno (la hora y lo pendiente con el equipo, CU3).
    context: request.messages[1]?.role === "system" ? request.messages[1].content : null,
    summary: request.messages.find((message) => message.content.startsWith(SUMMARY_MARK))?.content ?? null,
    messages: request.messages.length,
    // El resultado de la herramienta que acaba de usar, si viene de una.
    toolResult: last?.role === "tool" ? last.content : null,
  });
  if (last?.role === "tool") {
    const result = JSON.parse(last.content) as { status: string; output?: { results?: { text: string }[]; appointments?: unknown[] } };
    const found = result.output?.results;
    if (found) return say(found[0] ? `Según el centro: ${found[0].text}` : "Una persona del equipo te contestará enseguida.");
    // Sus citas: con una, la dice; sin ninguna, la reserva.
    const appointments = result.output?.appointments;
    if (appointments) {
      if (appointments.length > 0) return say("Ya tienes tu cita del lunes a las 9:00.");
      const plan = currentPlan();
      return call("book_appointment", { service_id: plan.serviceId, resource_id: plan.resourceId, starts_at: plan.startsAt });
    }
    const answer = say(result.status === "executed" ? "Tengo hueco el lunes a las 9:00." : "Una persona del equipo te lo confirma enseguida.");
    return /un momento/i.test(customer) ? gated(answer) : answer;
  }
  // La pregunta, sin la marca de mensaje del cliente.
  if (/y mi cita/i.test(customer)) {
    const context = request.messages[1]?.role === "system" ? request.messages[1].content : "";
    if (/^- Reservar /m.test(context)) return say("Tu reserva está pendiente de que la confirme el equipo.");
    return call("list_my_appointments", {});
  }
  if (/cuesta|precio|tatuaje/i.test(customer)) return call("search_knowledge", { query: customer.split("\n").slice(1).join("\n") });
  if (/res[eé]rv/i.test(customer)) {
    const plan = currentPlan();
    return call("book_appointment", { service_id: plan.serviceId, resource_id: plan.resourceId, starts_at: plan.startsAt });
  }
  if (/lista de espera/i.test(customer)) {
    return call("join_waitlist", { service_id: serviceIdFromPrompt(system, "Láser"), from: "2030-06-03T00:00:00+02:00", until: "2030-06-10T00:00:00+02:00" });
  }
  if (/hueco/i.test(customer)) return call("find_slots", { service_id: serviceIdFromPrompt(system, "Láser"), from: "2030-06-03T00:00:00+02:00" });
  // Pide una persona (CU3): request_human con su motivo (con «un momento», después de pensar).
  if (/hablar con una persona/i.test(customer)) {
    const asked = call("request_human", { reason: "customer_asked" });
    return /un momento/i.test(customer) ? gated(asked) : asked;
  }
  if (/un momento/i.test(customer)) return gated(say("Ya está, te lo confirmo ahora mismo."));
  // Una respuesta vacía: el turno pasa la conversación a una persona.
  if (/médic/i.test(customer)) return say("   ");
  return say("Hola, soy el asistente de IA del centro.");
}

const config = loadConfig(process.env);
const logger = createLogger(config.logLevel);
const router = createModelRouter([createFakeTransport({ provider: "fake", respond })]);
// 256 dimensiones: con pocas, las palabras chocan en el hash y el orden sale al azar.
const embedder = createFakeEmbedder(256);
const route: RouteOrigin = { provider: "vercel-ai-gateway", region: "other", connection: "managed" };
const worker = createWorker(config, logger, {
  eventHandlers: [
    logHandler,
    createConverseHandler({ router, knowledge: { embedder, route }, platform }),
    createApprovalHandler({ skills: codeSkills, platform }),
    createIngestHandler({ embedder, route }),
  ],
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
