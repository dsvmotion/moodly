import { BRAND_NAME, NOTIFICATION_EMAIL_FROM } from "@repo/config";
import type { TenantDb } from "@repo/db/service";
import { EmailSendError, type EmailSender, type SendEmailRequest } from "@repo/integrations";
import { describe, expect, it } from "vitest";
import { StepRetriesExhaustedError, type DomainEvent, type EventContext, type StepRetry } from "../events/handlers.ts";
import { createLogger } from "../logger.ts";
import { checkBudgetSafely } from "../usage/budget-check.ts";
import { BUDGET_EMAIL_HANDLER_KEY, budgetLinkUrl, buildBudgetEmails, createBudgetEmailHandler } from "./budget-email.ts";
import { SEND_RETRY } from "./send.ts";

// El aviso por email del tope mensual (PL-ledger). Sin base de datos ni red:
// budget_notification y Resend, falsos. Quién recibe el aviso y que salga una
// sola vez por mes y umbral lo decide la base de datos (46_budget_notices y la
// integración): aquí, que el consumidor envía exactamente a quien le dio la base
// de datos, uno por persona, en su idioma y con su clave de idempotencia.

const ORG = "a0000000-0000-4000-8000-000000000000";
const ADMIN = "a3000000-0000-4000-8000-000000000001";
const ADMIN_2 = "a3000000-0000-4000-8000-000000000009";
const WEB = "https://staging.moodlycrm.com";

function notification(overrides: Record<string, unknown> = {}) {
  return {
    organization: { name: "Clínica Demo", default_locale: "es-ES" },
    notice: { month: "2026-11-01", threshold: 80, spent_eur: 240.5, budget_eur: 300, created_at: "2026-11-20T10:00:00+00:00" },
    recipients: [
      { user_id: ADMIN, email: "admin@example.test", locale: "es-ES" },
      { user_id: ADMIN_2, email: "admin2@example.test", locale: "en-GB" },
    ],
    ...overrides,
  };
}

function event(payload: Record<string, unknown> = { month: "2026-11-01", threshold: 80 }): DomainEvent {
  return {
    id: "e0000000-0000-4000-8000-000000000002",
    type: "usage.budget_threshold",
    organizationId: ORG,
    locationId: null,
    payload,
    sourceRunId: null,
    chainDepth: 0,
    createdAt: "2026-11-20T10:00:00Z",
  };
}

function harness(data: unknown, send: (request: SendEmailRequest) => Promise<{ id: string }> = async () => ({ id: "x" })) {
  const lines: string[] = [];
  const logger = createLogger("debug", { write: (line: string) => void lines.push(line) });
  const loads: [string, number][] = [];
  const sent: SendEmailRequest[] = [];
  const steps: { name: string; retry: StepRetry | undefined }[] = [];
  const db = {
    organizationId: ORG,
    budgetNotification: async (month: string, threshold: number) => {
      loads.push([month, threshold]);
      return data;
    },
  } as unknown as TenantDb;
  const ctx: EventContext = {
    db,
    logger,
    // Como DBOS: un paso que lanza se repite hasta retry.maxAttempts veces y después lanza.
    step: async (name, fn, retry) => {
      steps.push({ name, retry });
      const attempts = retry?.maxAttempts ?? 1;
      for (let attempt = 1; ; attempt += 1) {
        try {
          return await fn();
        } catch (err) {
          if (attempt >= attempts) throw retry ? new StepRetriesExhaustedError(`agotó ${name}`, { cause: err }) : err;
        }
      }
    },
  };
  const sender: EmailSender = {
    send: async (request) => {
      sent.push(request);
      return send(request);
    },
  };
  return { ctx, sender, sent, loads, steps, lines };
}

describe("buildBudgetEmails", () => {
  it("un email por org_admin, en su idioma, desde la dirección de avisos y con su clave de idempotencia", () => {
    const emails = buildBudgetEmails(ORG, notification() as never, WEB);
    expect(emails.map((email) => [email.userId, email.request.to, email.request.subject])).toEqual([
      [ADMIN, "admin@example.test", "Habéis gastado el 80 % del tope mensual de IA"],
      [ADMIN_2, "admin2@example.test", "You've used 80% of your monthly AI cap"],
    ]);
    expect(emails[0]?.request.from).toEqual({ email: NOTIFICATION_EMAIL_FROM, name: BRAND_NAME });
    expect(emails.map((email) => email.request.idempotencyKey)).toEqual([`budget:${ORG}:2026-11-01:80:${ADMIN}`, `budget:${ORG}:2026-11-01:80:${ADMIN_2}`]);
    expect(emails[0]?.request.text).toContain(`${WEB}/app\n`);
  });

  it("la misma persona dos veces recibe un solo email", () => {
    const one = { user_id: ADMIN, email: "admin@example.test", locale: "es-ES" };
    expect(buildBudgetEmails(ORG, notification({ recipients: [one, one] }) as never, WEB)).toHaveLength(1);
  });

  it("el enlace va al inicio de la app, no a unos ajustes que aún no existen", () => {
    expect(budgetLinkUrl(WEB)).toBe("https://staging.moodlycrm.com/app");
  });
});

describe("notify.budget_email", () => {
  it("consume usage.budget_threshold por la cola de avisos", () => {
    const handler = createBudgetEmailHandler({ sender: null, webAppUrl: null });
    expect([handler.key, handler.eventTypes, handler.queue]).toEqual([BUDGET_EMAIL_HANDLER_KEY, ["usage.budget_threshold"], "notifications"]);
  });

  it("lee el aviso del mes y el umbral del evento, en su organización, y envía a sus destinatarios, cada uno en su paso", async () => {
    const h = harness(notification());
    await createBudgetEmailHandler({ sender: h.sender, webAppUrl: WEB }).handle(event(), h.ctx);
    expect(h.loads).toEqual([["2026-11-01", 80]]);
    expect(h.sent.map((request) => request.to)).toEqual(["admin@example.test", "admin2@example.test"]);
    expect(h.steps).toEqual([
      { name: "load", retry: undefined },
      { name: `send:${ADMIN}`, retry: SEND_RETRY },
      { name: `send:${ADMIN_2}`, retry: SEND_RETRY },
    ]);
  });

  it("los destinatarios nunca salen del payload", async () => {
    const h = harness(notification({ recipients: [{ user_id: ADMIN, email: "admin@example.test", locale: "es-ES" }] }));
    const payload = { month: "2026-11-01", threshold: 80, recipients: [{ email: "intruso@example.test" }], email: "intruso@example.test" };
    await createBudgetEmailHandler({ sender: h.sender, webAppUrl: WEB }).handle(event(payload), h.ctx);
    expect(h.sent.map((request) => request.to)).toEqual(["admin@example.test"]);
  });

  it("un evento sin mes o umbral válidos no lee ni envía nada", async () => {
    for (const payload of [{}, { month: "2026-11-15", threshold: 80 }, { month: "2026-11-01", threshold: 50 }, { month: "x", threshold: "80" }]) {
      const h = harness(notification());
      await createBudgetEmailHandler({ sender: h.sender, webAppUrl: WEB }).handle(event(payload), h.ctx);
      expect([h.loads, h.sent]).toEqual([[], []]);
      expect(h.lines.map((line) => JSON.parse(line).level)).toEqual(["error"]);
    }
  });

  it("sin clave de Resend o sin WEB_APP_URL no lee ni envía: registra un aviso y sigue", async () => {
    for (const [sender, webAppUrl, missing] of [
      [null, WEB, "RESEND_API_KEY"],
      ["sender", null, "WEB_APP_URL"],
    ] as const) {
      const h = harness(notification());
      await createBudgetEmailHandler({ sender: sender ? h.sender : null, webAppUrl }).handle(event(), h.ctx);
      expect([h.loads, h.sent]).toEqual([[], []]);
      expect(h.lines.join("")).toContain(missing);
    }
  });

  it("un aviso que no es de la organización (null) o que no tiene la forma esperada no se envía", async () => {
    for (const data of [null, { organization: {} }]) {
      const h = harness(data);
      await createBudgetEmailHandler({ sender: h.sender, webAppUrl: WEB }).handle(event(), h.ctx);
      expect(h.sent).toEqual([]);
    }
  });

  it("un fallo pasajero se reintenta con la misma clave: una sola vez por persona", async () => {
    let failures = 0;
    const h = harness(notification(), async (request) => {
      if (request.to === "admin@example.test" && failures < 3) {
        failures += 1;
        throw new EmailSendError("Resend rechazó el email (503 application_error)", 503, "transient");
      }
      return { id: "ok" };
    });
    await createBudgetEmailHandler({ sender: h.sender, webAppUrl: WEB }).handle(event(), h.ctx);
    const admin = h.sent.filter((request) => request.to === "admin@example.test");
    expect(admin).toHaveLength(4);
    expect(new Set(admin.map((request) => request.idempotencyKey))).toEqual(new Set([`budget:${ORG}:2026-11-01:80:${ADMIN}`]));
    expect(h.lines.join("")).toMatch(/"sent":2/);
  });

  it("ningún email ni importe en los logs", async () => {
    const h = harness(notification());
    await createBudgetEmailHandler({ sender: h.sender, webAppUrl: WEB }).handle(event(), h.ctx);
    const logs = h.lines.join("\n");
    expect(logs).toContain("avisos del tope enviados");
    expect(logs).not.toContain("@example.test");
    expect(logs).not.toContain("240");
  });
});

describe("checkBudgetSafely", () => {
  function logs() {
    const lines: string[] = [];
    return { lines, logger: createLogger("debug", { write: (line: string) => void lines.push(line) }) };
  }

  it("devuelve los umbrales de los que se acaba de avisar y lo registra", async () => {
    const { lines, logger } = logs();
    const db = { checkBudgetThresholds: async () => [100] } as unknown as TenantDb;
    expect(await checkBudgetSafely(db, logger, { runId: "r1" })).toEqual([100]);
    expect(JSON.parse(lines[0] ?? "{}")).toMatchObject({ level: "info", runId: "r1", thresholds: [100] });
  });

  it("si la comprobación falla, no lanza: registra el error y sigue", async () => {
    const { lines, logger } = logs();
    const db = {
      checkBudgetThresholds: async () => {
        throw new TypeError("caída");
      },
    } as unknown as TenantDb;
    expect(await checkBudgetSafely(db, logger, { runId: "r1" })).toEqual([]);
    expect(JSON.parse(lines[0] ?? "{}")).toMatchObject({ level: "error", runId: "r1", error: "TypeError" });
  });
});
