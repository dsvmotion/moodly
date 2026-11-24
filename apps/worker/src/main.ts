// Proceso del worker: `pnpm --filter @repo/worker start` (o `dev` en local).
import { createGatewayEmbedder } from "@repo/agent-core";
import { createWhatsAppAdapter } from "@repo/channels";
import { WHATSAPP_GRAPH_API_VERSION } from "@repo/config";
import { createNangoPlatform, createResendSender } from "@repo/integrations";
import { createLocalIngressKeyring } from "@repo/integrations/key-ingress";
import { createApprovalHandler } from "./agents/approvals.ts";
import { createChannelSendHandler } from "./channels/send.ts";
import { codeSkills, createConverseHandler } from "./agents/converse.ts";
import { createWorkerModels } from "./agents/model-router.ts";
import { loadConfig } from "./config.ts";
import { createHealthServer } from "./health.ts";
import { createKeyCleanupHandler, createKoiboxVerifier, registerKeySubmissions } from "./integrations/key-submission.ts";
import { createNangoWebhookHandler } from "./integrations/nango-webhook.ts";
import { logHandler } from "./events/log-handler.ts";
import { createIngestHandler } from "./knowledge/ingest.ts";
import { LeaseAbortedError } from "./lease.ts";
import { createLogger } from "./logger.ts";
import { createApprovalEmailHandler } from "./notifications/approval-email.ts";
import { createBudgetEmailHandler } from "./notifications/budget-email.ts";
import { createHandoffEmailHandler } from "./notifications/handoff-email.ts";
import { registerReminders } from "./reminders/reminders.ts";
import { createLocalKeyProvider, createSecretVault } from "./secrets/vault.ts";
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
// WhatsApp por la Cloud API de Meta (O-01, ADR 0020). Sin sus tres variables no
// se abre /channels/whatsapp (404), los mensajes de WhatsApp no entran y las
// respuestas por WhatsApp se quedan pending.
const whatsapp = config.whatsapp ? createWhatsAppAdapter({ ...config.whatsapp, graphApiVersion: WHATSAPP_GRAPH_API_VERSION }) : null;
if (!whatsapp) logger.warn("sin WHATSAPP_APP_SECRET, WHATSAPP_VERIFY_TOKEN y WHATSAPP_ACCESS_TOKEN: no entra nada por WhatsApp");
// La plataforma de conectores (Nango, O-02): la usan el webhook que activa una
// integración y el turno del agente, para que un calendario conectado cuente al
// ofrecer huecos. Sin las dos claves de Nango no hay plataforma.
const platform = config.nango ? createNangoPlatform({ secretKey: config.nango.secretKey, host: config.nango.host }) : null;
// El alta de claves de integraciones (ADR 0055): con las claves locales en
// desarrollo; en staging y producción, sin claves todavía (irán en AWS KMS),
// los envíos solo caducan a los 15 minutos.
const keyring = config.localKeys ? createLocalIngressKeyring([{ keyRef: "local:v1", privateKeyPem: config.localKeys.ingressPrivateKeyPem }]) : null;
const vault = config.localKeys ? createSecretVault(createLocalKeyProvider(config.localKeys.vaultMasterKey)) : null;
if (!keyring) logger.warn("sin claves de ingreso ni de SecretVault: las claves de integraciones que se envíen solo caducan");
const waiting = new AbortController();
const worker = createWorker(config, logger, {
  signal: waiting.signal,
  channelAdapters: whatsapp ? [whatsapp] : [],
  // agent.converse: el turno del agente con cada mensaje de un cliente (paso 4d-3),
  // que busca en el conocimiento del negocio con los mismos embeddings (B20-2).
  // agent.approval: lo que una persona aprueba se ejecuta; lo que rechaza, no (4d-3d).
  // reception.reminders: los recordatorios de cada cita, 24 h y 4 h antes (4e-2).
  // reception.waitlist: el hueco de una cita cancelada, a la lista de espera (4f-2).
  // integrations.key_submission: la clave enviada de una integración nativa, abierta, comprobada y guardada (ADR 0055).
  // integrations.key_cleanup: el secreto de una integración nativa desconectada, borrado (ADR 0055 §5).
  // notify.approval_email: el aviso por email a quien puede decidir una aprobación nueva (M-02).
  // notify.budget_email: el aviso por email a los org_admin al 80 % y al 100 % del tope del mes (PL-ledger).
  // knowledge.ingest: cada fuente de conocimiento nueva o cambiada, troceada e indexada (B20-1).
  // channels.send: lo que sale por WhatsApp, una sola vez (O-01); sin el adaptador, se queda pending.
  eventHandlers: ({ db }) => [
    logHandler,
    createConverseHandler({
      router: models.router,
      intentRouting: config.intentRouting,
      ...(embedder ? { knowledge: { embedder, route: embedder.route } } : {}),
      ...(platform ? { platform } : {}),
    }),
    createApprovalHandler({ skills: codeSkills, ...(platform ? { platform } : {}) }),
    registerReminders({ db, logger }),
    registerWaitlistOffers({ db, logger }),
    registerKeySubmissions({ db, logger, keyring, vault, verify: createKoiboxVerifier({ apiBase: config.koiboxApiBase }) }),
    createKeyCleanupHandler(),
    createApprovalEmailHandler({ sender: emailSender, webAppUrl: config.webAppUrl }),
    createBudgetEmailHandler({ sender: emailSender, webAppUrl: config.webAppUrl }),
    createHandoffEmailHandler({ sender: emailSender, webAppUrl: config.webAppUrl }),
    ...(embedder ? [createIngestHandler({ embedder, route: embedder.route })] : []),
    createChannelSendHandler({ adapters: new Map(whatsapp ? [["whatsapp", whatsapp]] : []) }),
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
// Y el webhook de Nango (O-02): lo único que activa una integración de
// plataforma. Sin las dos claves de Nango no se monta (404).
let nangoWebhook: ReturnType<typeof createNangoWebhookHandler> | undefined;
if (config.nango && platform) {
  nangoWebhook = createNangoWebhookHandler({
    db: worker.db,
    platform,
    signingKey: config.nango.webhookSigningKey,
    logger,
    // Como /channels/: 503 hasta que el worker está en marcha (Nango reintenta).
    ready: () => worker.probe.phase() === "running",
  });
} else {
  logger.warn("sin NANGO_API_KEY o NANGO_WEBHOOK_SIGNING_KEY: no se activan integraciones de plataforma (/webhooks/nango no existe)");
}
const health = createHealthServer({
  probe: worker.probe,
  logger,
  // La entrada de canales comparte el puerto (Railway publica uno): 404 mientras no haya ningún canal.
  channels: worker.channels,
  // Los webhooks de las plataformas (O-02), igual: 404 sin las claves de Nango.
  ...(nangoWebhook ? { webhooks: nangoWebhook } : {}),
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
