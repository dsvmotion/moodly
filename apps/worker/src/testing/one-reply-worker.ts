// Proceso de prueba para ingress/one-reply.integration.ts (gate M1): el worker
// de verdad con la cadena entera de WhatsApp —la entrada de canales, el turno
// del agente con un modelo falso con guion, y channels.send contra la Graph API
// falsa del test— para comprobar que un mensaje del cliente recibe UNA sola
// respuesta, aunque llegue otro a mitad del turno.
//
// El modelo falso: si el cliente dice «un momento», se queda pensando hasta que
// exista <archivo>.gate (lo crea el test después de mandar el segundo mensaje);
// si no, saluda con una respuesta directa. Apunta cada llamada (y cada «gate»)
// en <archivo>, una línea JSON.
//
//   PORT=… INGRESS_TEST_SECRET=… WHATSAPP_TEST_GRAPH_URL=… node one-reply-worker.ts <archivo>
import { appendFileSync, existsSync, rmSync } from "node:fs";
import { createFakeTransport, createModelRouter } from "@repo/agent-core";
import type { TransportRequest, TransportResponse } from "@repo/agent-core";
import { createWhatsAppAdapter } from "@repo/channels";
import { WHATSAPP_GRAPH_API_VERSION } from "@repo/config";
import { createApprovalHandler } from "../agents/approvals.ts";
import { codeSkills, createConverseHandler } from "../agents/converse.ts";
import { createChannelSendHandler } from "../channels/send.ts";
import { loadConfig } from "../config.ts";
import { createHealthServer } from "../health.ts";
import { logHandler } from "../events/log-handler.ts";
import { createLogger } from "../logger.ts";
import { createWorker } from "../worker.ts";

const [effectsFile] = process.argv.slice(2);
if (!effectsFile) throw new Error("uso: one-reply-worker.ts <archivo>");
const secret = process.env["INGRESS_TEST_SECRET"];
if (!secret) throw new Error("falta INGRESS_TEST_SECRET");
const graphBaseUrl = process.env["WHATSAPP_TEST_GRAPH_URL"];
if (!graphBaseUrl) throw new Error("falta WHATSAPP_TEST_GRAPH_URL");

function effect(record: Record<string, unknown>): void {
  appendFileSync(effectsFile as string, `${JSON.stringify(record)}\n`);
}

const usage = { model: "fake/fast", tokensIn: 100, tokensOut: 20, costEur: 0.0002 };
const say = (text: string): TransportResponse => ({ text, ...usage });

/** Espera a que el test abra la puerta: mientras, el turno de este mensaje está a medias. */
async function gated(response: TransportResponse): Promise<TransportResponse> {
  const gate = `${effectsFile as string}.gate`;
  effect({ step: "gate" });
  while (!existsSync(gate)) await new Promise((resolve) => setTimeout(resolve, 50));
  rmSync(gate, { force: true });
  return response;
}

function respond(request: TransportRequest): TransportResponse | Promise<TransportResponse> {
  const customer = [...request.messages].reverse().find((message) => message.role === "user")?.content ?? "";
  effect({ step: "model", customer });
  if (/un momento/i.test(customer)) return gated(say("Ya está, te lo confirmo ahora mismo."));
  return say("Hola, soy el asistente de IA del centro.");
}

const config = loadConfig(process.env);
const logger = createLogger(config.logLevel);
const router = createModelRouter([createFakeTransport({ provider: "fake", respond })]);
const whatsapp = createWhatsAppAdapter({
  appSecret: secret,
  verifyToken: secret,
  accessToken: "token-de-prueba",
  graphApiVersion: WHATSAPP_GRAPH_API_VERSION,
  graphBaseUrl,
  timeoutMs: 2_000,
});
const worker = createWorker(config, logger, {
  // El publicador del outbox, cada segundo en vez de cada 5 s: cada turno o aviso del test
  // empieza por un evento de dominio, y así no espera a la vuelta de producción.
  schedulesTesting: { outboxPublish: "* * * * * *" },
  channelAdapters: [whatsapp],
  eventHandlers: [
    logHandler,
    createConverseHandler({ router }),
    createApprovalHandler({ skills: codeSkills }),
    createChannelSendHandler({ adapters: new Map([["whatsapp", whatsapp]]), retryDelaysMs: [0, 0] }),
  ],
  onLeaseLost: (err) => {
    logger.fatal({ err }, "se perdió el lock del executor");
    process.exit(1);
  },
});
const health = createHealthServer({ probe: worker.probe, logger, channels: worker.channels });
health.listen(config.healthPort, () => logger.info({ port: config.healthPort }, "endpoint de salud escuchando"));
process.on("SIGTERM", () => {
  void worker.stop().then(() => process.exit(0));
});
await worker.start();
effect({ step: "started" });
