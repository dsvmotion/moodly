// Proceso de prueba para reminders/reminders.integration.ts: el worker real con
// el consumidor reception.reminders y los recordatorios a unos segundos de la
// cita en vez de a 24 h y 4 h, y unos segundos de separación mínima en vez de
// 1 h (REMINDER_TIMING_MS, en milisegundos). Las horas de silencio son las de
// verdad (de 22:00 a 07:00 del local).
//
//   REMINDER_TIMING_MS='{"24h":30000,"4h":8000,"minGap":5000}' node reminders-worker.ts <archivo>
//
// Al arrancar escribe «started» en el archivo.
import { appendFileSync } from "node:fs";
import { loadConfig } from "../config.ts";
import { logHandler } from "../events/log-handler.ts";
import { createLogger } from "../logger.ts";
import { REMINDER_RULES, registerReminders } from "../reminders/reminders.ts";
import { createWorker } from "../worker.ts";

const [markerFile] = process.argv.slice(2);
if (!markerFile) throw new Error("uso: reminders-worker.ts <archivo>");
const timing = JSON.parse(process.env["REMINDER_TIMING_MS"] ?? "null") as { "24h": number; "4h": number; minGap: number } | null;
const rules = timing ? { ...REMINDER_RULES, offsets: { "24h": timing["24h"], "4h": timing["4h"] }, minGapMs: timing.minGap } : REMINDER_RULES;

const config = loadConfig(process.env);
const logger = createLogger(config.logLevel);
const worker = createWorker(config, logger, {
  // El publicador del outbox, cada segundo en vez de cada 5 s: cada turno o aviso del test
  // empieza por un evento de dominio, y así no espera a la vuelta de producción.
  schedulesTesting: { outboxPublish: "* * * * * *" },
  eventHandlers: ({ db }) => [logHandler, registerReminders({ db, logger, rules })],
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
