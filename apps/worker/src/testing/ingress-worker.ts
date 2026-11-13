// Proceso de prueba para ingress/ingress.integration.ts: el worker real con la
// entrada de canales montada en su servidor de salud (PORT, como en main.ts) y
// el adaptador de prueba de
// @repo/channels, firmado con INGRESS_TEST_SECRET. Solo el consumidor de log:
// lo que se prueba es la entrada, no el turno del agente. Fallos inyectados por
// el id del evento del proveedor: «fail-twice-…» falla los dos primeros
// intentos y «fail-always-…», todos (hasta el dead_letter), con esperas cortas.
//
//   PORT=… INGRESS_TEST_SECRET=… node ingress-worker.ts
import { createWhatsAppAdapter } from "@repo/channels";
import { createFakeAdapter } from "@repo/channels/testing";
import { WHATSAPP_GRAPH_API_VERSION } from "@repo/config";
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
const recordFailures = new Map<string, number>();
async function providerEventId(input: { organizationId: string; inboundEventId: string }): Promise<string> {
  const { data, error } = await db
    .forOrganization(input.organizationId)
    .from("inbound_events")
    .select("provider_event_id")
    .eq("id", input.inboundEventId)
    .single();
  if (error) throw new Error(`no se pudo leer el evento (${error.code})`);
  return data.provider_event_id;
}
const worker = createWorker(config, logger, {
  ingestTesting: {
    backoffMs: [100, 100, 100, 100],
    sweepMinAgeMs: 0,
    // El barrido cada 2 s en lugar de cada minuto (a los 23 s): los tests de rebobinado no esperan al reloj.
    sweepSchedule: "*/2 * * * * *",
    async beforeAttempt(input, attempt) {
      const data = { provider_event_id: await providerEventId(input) };
      const id = data.provider_event_id;
      const failing =
        id.startsWith("fail-always-") ||
        id.startsWith("fail-recdead-") ||
        (id.startsWith("fail-twice-") && attempt <= 2) ||
        (id.startsWith("fail-record-") && attempt <= 3);
      if (failing) throw Object.assign(new Error("fallo inyectado"), { code: "injected" });
    },
    // «fail-record-…» y «fail-recdead-…»: el apunte del tercer intento falla las 4 veces que lo
    // intenta DBOS (el workflow queda en ERROR con dos intentos ya apuntados); después de rebobinarlo,
    // sale bien. «fail-record-» acierta al cuarto intento; «fail-recdead-» falla siempre (dead_letter).
    async beforeRecordFailure(input, attempt) {
      if (attempt !== 3) return;
      const key = `${input.inboundEventId}:${attempt}`;
      const seen = recordFailures.get(key) ?? 0;
      recordFailures.set(key, seen + 1);
      const id = await providerEventId(input);
      if (seen < 4 && (id.startsWith("fail-record-") || id.startsWith("fail-recdead-"))) throw new Error("apunte inyectado que falla");
    },
  },
  eventHandlers: [logHandler],
  // webchat firma por cuenta (como el token del chat web); email, por plataforma (como Meta).
  // Y WhatsApp, el adaptador de verdad (O-01): Meta firma con el secreto de la app y
  // el alta usa el token de verificación; los dos, INGRESS_TEST_SECRET. Aquí no envía nada.
  channelAdapters: [
    createFakeAdapter({ channel: "webchat", secret, scope: "account" }),
    createFakeAdapter({ channel: "email", secret }),
    createWhatsAppAdapter({ appSecret: secret, verifyToken: secret, accessToken: "token-sin-uso-en-tests", graphApiVersion: WHATSAPP_GRAPH_API_VERSION }),
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
