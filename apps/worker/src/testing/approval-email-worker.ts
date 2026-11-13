// Proceso de prueba para notifications/approval-email.integration.ts: el worker
// real con los consumidores notify.approval_email, notify.budget_email (el
// aviso del tope mensual) y notify.handoff_email (el paso a una persona, CU3) y
// el cliente de Resend de
// verdad, que envía a un servidor falso (FAKE_RESEND_URL) en vez de a Resend.
//
//   FAKE_RESEND_URL=http://127.0.0.1:<puerto> RESEND_API_KEY=re_… WEB_APP_URL=… node approval-email-worker.ts
//
// Los reintentos de cada envío, cortos (10 intentos cada 0,1 s) para que el
// test no espere los minutos de SEND_RETRY.
import { createResendSender } from "@repo/integrations";
import { loadConfig } from "../config.ts";
import { logHandler } from "../events/log-handler.ts";
import { createLogger } from "../logger.ts";
import { createApprovalEmailHandler } from "../notifications/approval-email.ts";
import { createBudgetEmailHandler } from "../notifications/budget-email.ts";
import { createHandoffEmailHandler } from "../notifications/handoff-email.ts";
import { createWorker } from "../worker.ts";

const baseUrl = process.env["FAKE_RESEND_URL"];
if (!baseUrl) throw new Error("falta FAKE_RESEND_URL");

const config = loadConfig(process.env);
const logger = createLogger(config.logLevel);
const sender = config.resendApiKey ? createResendSender({ apiKey: config.resendApiKey, baseUrl }) : null;
const retry = { maxAttempts: 10, intervalSeconds: 0.1, backoffRate: 1 };
const worker = createWorker(config, logger, {
  // El publicador del outbox cada segundo en lugar de cada 5 s: estos tests esperan a la entrega, no prueban el publicador (eso, outbox.integration.ts).
  outboxTesting: { publishSchedule: "* * * * * *" },
  eventHandlers: [
    logHandler,
    createApprovalEmailHandler({ sender, webAppUrl: config.webAppUrl, retry }),
    createBudgetEmailHandler({ sender, webAppUrl: config.webAppUrl, retry }),
    createHandoffEmailHandler({ sender, webAppUrl: config.webAppUrl, retry }),
  ],
  onLeaseLost: (err) => {
    logger.fatal({ err }, "se perdió el lock del executor");
    process.exit(1);
  },
});
process.on("SIGTERM", () => {
  void worker.stop().then(() => process.exit(0));
});
await worker.start();
