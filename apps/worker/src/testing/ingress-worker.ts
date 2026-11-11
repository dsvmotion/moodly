// Proceso de prueba para ingress/ingress.integration.ts: el worker real con la
// entrada de canales abierta (INGRESS_PORT) y el adaptador de prueba de
// @repo/channels, firmado con INGRESS_TEST_SECRET. Solo el consumidor de log:
// lo que se prueba es la entrada, no el turno del agente.
//
//   INGRESS_PORT=… INGRESS_TEST_SECRET=… node ingress-worker.ts
import { createFakeAdapter } from "@repo/channels";
import { loadConfig } from "../config.ts";
import { logHandler } from "../events/log-handler.ts";
import { createLogger } from "../logger.ts";
import { createWorker } from "../worker.ts";

const secret = process.env["INGRESS_TEST_SECRET"];
if (!secret) throw new Error("falta INGRESS_TEST_SECRET");
const config = loadConfig(process.env);
const logger = createLogger(config.logLevel);
const worker = createWorker(config, logger, {
  eventHandlers: [logHandler],
  channelAdapters: [createFakeAdapter({ channel: "webchat", secret })],
  onLeaseLost: (err) => {
    logger.fatal({ err }, "se perdió el lock del executor");
    process.exit(1);
  },
});
process.on("SIGTERM", () => {
  void worker.stop().then(() => process.exit(0));
});
await worker.start();
