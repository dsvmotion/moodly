// Proceso de prueba para reminders/reminders.integration.ts: el worker real con
// el consumidor reception.reminders y los recordatorios a unos segundos de la
// cita en vez de a 24 h y 4 h (REMINDER_OFFSETS_MS, en milisegundos).
//
//   REMINDER_OFFSETS_MS='{"24h":20000,"4h":8000}' node reminders-worker.ts <archivo>
//
// Al arrancar escribe «started» en el archivo.
import { appendFileSync } from "node:fs";
import { loadConfig } from "../config.ts";
import { logHandler } from "../events/log-handler.ts";
import { createLogger } from "../logger.ts";
import { registerReminders, type ReminderOffsets } from "../reminders/reminders.ts";
import { createWorker } from "../worker.ts";

const [markerFile] = process.argv.slice(2);
if (!markerFile) throw new Error("uso: reminders-worker.ts <archivo>");
const offsets = JSON.parse(process.env["REMINDER_OFFSETS_MS"] ?? "null") as ReminderOffsets | null;

const config = loadConfig(process.env);
const logger = createLogger(config.logLevel);
const worker = createWorker(config, logger, {
  eventHandlers: ({ db }) => [logHandler, registerReminders({ db, logger, ...(offsets ? { offsets } : {}) })],
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
