// Proceso de prueba para ingress/ingress.integration.ts: el worker real con la
// entrada de canales montada en su servidor de salud (PORT, como en main.ts) y
// el adaptador de prueba de
// @repo/channels, firmado con INGRESS_TEST_SECRET. Solo el consumidor de log:
// lo que se prueba es la entrada, no el turno del agente. Fallos inyectados por
// el id del evento del proveedor: «fail-twice-…» falla los dos primeros
// intentos y «fail-always-…», todos (hasta el dead_letter), con esperas cortas.
//
//   PORT=… INGRESS_TEST_SECRET=… node ingress-worker.ts
import { createFakeAdapter } from "@repo/channels/testing";
import { createServiceDb } from "@repo/db/service";
import { loadConfig } from "../config.ts";
import { createHealthServer } from "../health.ts";
import { logHandler } from "../events/log-handler.ts";
import { createLogger } from "../logger.ts";
import { createWorker } from "../worker.ts";

const secret = process.env["INGRESS_TEST_SECRET"];
if (!secret) throw new Error("falta INGRESS_TEST_SECRET");
const config = loadConfig(process.env);
const logger = createLogger(config.logLevel);
const db = createServiceDb({ url: config.supabaseUrl, secretKey: config.supabaseSecretKey });
const worker = createWorker(config, logger, {
  ingestTesting: {
    backoffMs: [100, 100, 100, 100],
    async beforeAttempt(input, attempt) {
      const { data, error } = await db
        .forOrganization(input.organizationId)
        .from("inbound_events")
        .select("provider_event_id")
        .eq("id", input.inboundEventId)
        .single();
      if (error) throw new Error(`no se pudo leer el evento (${error.code})`);
      const failing = data.provider_event_id.startsWith("fail-always-") || (data.provider_event_id.startsWith("fail-twice-") && attempt <= 2);
      if (failing) throw Object.assign(new Error("fallo inyectado"), { code: "injected" });
    },
  },
  eventHandlers: [logHandler],
  // webchat firma por cuenta (como el token del chat web); email, por plataforma (como Meta).
  channelAdapters: [createFakeAdapter({ channel: "webchat", secret, scope: "account" }), createFakeAdapter({ channel: "email", secret })],
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
