// Proceso del worker: `pnpm --filter @repo/worker start` (o `dev` en local).
import { loadConfig } from "./config.ts";
import { createLogger } from "./logger.ts";
import { createWorker } from "./worker.ts";

const config = loadConfig(process.env);
const logger = createLogger(config.logLevel);
const worker = createWorker(config, logger);

let stopping = false;
async function stop(signal: NodeJS.Signals): Promise<void> {
  if (stopping) return;
  stopping = true;
  logger.info({ signal }, "parando el worker");
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
  logger.fatal({ err }, "el worker no arrancó");
  process.exit(1);
}
