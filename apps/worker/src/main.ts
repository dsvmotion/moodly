// Proceso del worker: `pnpm --filter @repo/worker start` (o `dev` en local).
import { createGatewayEmbedder } from "@repo/agent-core";
import { createResendSender } from "@repo/integrations";
import { createApprovalHandler } from "./agents/approvals.ts";
import { codeSkills, createConverseHandler } from "./agents/converse.ts";
import { createWorkerModels } from "./agents/model-router.ts";
import { loadConfig } from "./config.ts";
import { createHealthServer } from "./health.ts";
import { logHandler } from "./events/log-handler.ts";
import { createIngestHandler } from "./knowledge/ingest.ts";
import { LeaseAbortedError } from "./lease.ts";
import { createLogger } from "./logger.ts";
import { createApprovalEmailHandler } from "./notifications/approval-email.ts";
import { registerReminders } from "./reminders/reminders.ts";
import { registerWaitlistOffers } from "./waitlist/offers.ts";
import { createWorker } from "./worker.ts";

const config = loadConfig(process.env);
const logger = createLogger(config.logLevel);
const models = createWorkerModels(config);
if (models.transports.length === 0) {
  logger.warn("sin AI_GATEWAY_API_KEY: los agentes no llaman a ningún modelo y pasan cada conversación a una persona");
} else {
  logger.info({ providers: models.transports.map((transport) => transport.provider) }, "vías de modelo activas");
}
// Los embeddings del conocimiento, por el mismo gateway (ADR 0048). Sin clave no
// se registra knowledge.ingest: las fuentes que se creen o cambien se quedan en pending.
const embedder = config.aiGatewayApiKey ? createGatewayEmbedder({ apiKey: config.aiGatewayApiKey }) : null;
if (!embedder) logger.warn("sin AI_GATEWAY_API_KEY: las fuentes de conocimiento no se indexan");
// Los avisos por email (M-02), con Resend. Sin clave o sin la URL de la web, el
// consumidor registra cada aprobación que no avisa y sigue.
const emailSender = config.resendApiKey ? createResendSender({ apiKey: config.resendApiKey }) : null;
if (!emailSender) logger.warn("sin RESEND_API_KEY: no se avisa por email de las aprobaciones nuevas");
if (!config.webAppUrl) logger.warn("sin WEB_APP_URL: no se avisa por email de las aprobaciones nuevas");
const waiting = new AbortController();
const worker = createWorker(config, logger, {
  signal: waiting.signal,
  // agent.converse: el turno del agente con cada mensaje de un cliente (paso 4d-3),
  // que busca en el conocimiento del negocio con los mismos embeddings (B20-2).
  // agent.approval: lo que una persona aprueba se ejecuta; lo que rechaza, no (4d-3d).
  // reception.reminders: los recordatorios de cada cita, 24 h y 4 h antes (4e-2).
  // reception.waitlist: el hueco de una cita cancelada, a la lista de espera (4f-2).
  // notify.approval_email: el aviso por email a quien puede decidir una aprobación nueva (M-02).
  // knowledge.ingest: cada fuente de conocimiento nueva o cambiada, troceada e indexada (B20-1).
  eventHandlers: ({ db }) => [
    logHandler,
    createConverseHandler({
      router: models.router,
      intentRouting: config.intentRouting,
      ...(embedder ? { knowledge: { embedder, route: embedder.route } } : {}),
    }),
    createApprovalHandler({ skills: codeSkills }),
    registerReminders({ db, logger }),
    registerWaitlistOffers({ db, logger }),
    createApprovalEmailHandler({ sender: emailSender, webAppUrl: config.webAppUrl }),
    ...(embedder ? [createIngestHandler({ embedder, route: embedder.route })] : []),
  ],
  // Sin el lock, otro proceso con este executorID puede recuperar los mismos
  // workflows: se sale sin esperar a un apagado limpio (regla 1).
  onLeaseLost: (err) => {
    logger.fatal({ err }, "se perdió el lock del executor; el worker se para");
    process.exit(1);
  },
});

// Salud para el healthcheck de Railway y la alerta de staging (PL-health): se
// levanta antes de esperar el lock, para que el contenedor nuevo de un despliegue
// responda «standby» mientras el viejo sigue vivo.
const health = createHealthServer({
  probe: worker.probe,
  logger,
});
health.on("error", (err) => logger.error({ err }, "el endpoint de salud no pudo escuchar"));
health.listen(config.healthPort, () => logger.info({ port: config.healthPort }, "endpoint de salud escuchando"));

let stopping = false;
async function stop(signal: NodeJS.Signals): Promise<void> {
  if (stopping) return;
  stopping = true;
  logger.info({ signal }, "parando el worker");
  waiting.abort();
  try {
    await worker.stop();
    health.close();
    process.exit(0);
  } catch (err) {
    logger.error({ err }, "el worker no paró limpio");
    process.exit(1);
  }
}
process.on("SIGTERM", (signal) => void stop(signal));
process.on("SIGINT", (signal) => void stop(signal));

try {
  await worker.start();
} catch (err) {
  // Parado mientras esperaba el lock: stop() ya se encarga de salir.
  if (err instanceof LeaseAbortedError) await new Promise(() => {});
  logger.fatal({ err }, "el worker no arrancó");
  process.exit(1);
}
