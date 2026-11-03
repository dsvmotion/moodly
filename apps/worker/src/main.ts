// Proceso del worker: `pnpm --filter @repo/worker start` (o `dev` en local).
import { createConverseHandler } from "./agents/converse.ts";
import { createWorkerModels } from "./agents/model-router.ts";
import { loadConfig } from "./config.ts";
import { logHandler } from "./events/log-handler.ts";
import { LeaseAbortedError } from "./lease.ts";
import { createLogger } from "./logger.ts";
import { createWorker } from "./worker.ts";

const config = loadConfig(process.env);
const logger = createLogger(config.logLevel);
const models = createWorkerModels(config);
if (models.transports.length === 0) {
  logger.warn("sin AI_GATEWAY_API_KEY: los agentes no llaman a ningún modelo y pasan cada conversación a una persona");
} else {
  logger.info({ providers: models.transports.map((transport) => transport.provider) }, "vías de modelo activas");
}
const waiting = new AbortController();
const worker = createWorker(config, logger, {
  signal: waiting.signal,
  // agent.converse: el turno del agente con cada mensaje de un cliente (paso 4d-3).
  eventHandlers: [logHandler, createConverseHandler({ router: models.router })],
  // Sin el lock, otro proceso con este executorID puede recuperar los mismos
  // workflows: se sale sin esperar a un apagado limpio (regla 1).
  onLeaseLost: (err) => {
    logger.fatal({ err }, "se perdió el lock del executor; el worker se para");
    process.exit(1);
  },
});

let stopping = false;
async function stop(signal: NodeJS.Signals): Promise<void> {
  if (stopping) return;
  stopping = true;
  logger.info({ signal }, "parando el worker");
  waiting.abort();
  try {
    await worker.stop();
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
