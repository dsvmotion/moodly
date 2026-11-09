// Proceso de prueba para waitlist/offers.integration.ts: el worker real con el
// consumidor reception.waitlist y unos segundos de plazo por oferta en vez de
// 30 minutos (WAITLIST_OFFER_MS, en milisegundos). Las horas de silencio son
// las de verdad (de 22:00 a 07:00 del local).
//
//   WAITLIST_OFFER_MS=6000 node waitlist-worker.ts <archivo>
//
// Al arrancar escribe «started» en el archivo.
import { appendFileSync } from "node:fs";
import { loadConfig } from "../config.ts";
import { logHandler } from "../events/log-handler.ts";
import { createLogger } from "../logger.ts";
import { WAITLIST_RULES, registerWaitlistOffers } from "../waitlist/offers.ts";
import { createWorker } from "../worker.ts";

const [markerFile] = process.argv.slice(2);
if (!markerFile) throw new Error("uso: waitlist-worker.ts <archivo>");
const offerMs = Number(process.env["WAITLIST_OFFER_MS"] ?? "0");
const rules = offerMs > 0 ? { ...WAITLIST_RULES, offerMs } : WAITLIST_RULES;

const config = loadConfig(process.env);
const logger = createLogger(config.logLevel);
const worker = createWorker(config, logger, {
  eventHandlers: ({ db }) => [logHandler, registerWaitlistOffers({ db, logger, rules })],
  onLeaseLost: (err) => {
    logger.fatal({ err }, "se perdió el lock del executor");
    process.exit(1);
  },
});
process.on("SIGTERM", () => {
  void worker.stop().then(() => process.exit(0));
});
await worker.start();
appendFileSync(markerFile, `${JSON.stringify({ step: "started", pid: process.pid })}\n`);
