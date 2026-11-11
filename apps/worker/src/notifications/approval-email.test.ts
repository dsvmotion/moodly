import { BRAND_NAME, NOTIFICATION_EMAIL_FROM } from "@repo/config";
import type { TenantDb } from "@repo/db/service";
import { EmailSendError, type EmailSender, type SendEmailRequest } from "@repo/integrations";
import { describe, expect, it } from "vitest";
import { StepRetriesExhaustedError, type DomainEvent, type EventContext, type StepRetry } from "../events/handlers.ts";
import { createLogger } from "../logger.ts";
import {
  APPROVAL_EMAIL_HANDLER_KEY,
  EMAIL_UNAUTHORIZED_EVENT,
  SEND_RETRY,
  approvalUrl,
  buildApprovalEmails,
  createApprovalEmailHandler,
  emailLocale,
} from "./approval-email.ts";

// El aviso por email de una aprobación nueva (M-02). Sin base de datos ni red:
// approval_notification y Resend, falsos. A quién se envía lo decide la base de
// datos (40_approval_created y la integración): aquí, que el consumidor envía
// exactamente a quien le dio la base de datos, uno por persona y en su idioma.

const ORG = "a0000000-0000-4000-8000-000000000000";
const OTHER_ORG = "b0000000-0000-4000-8000-000000000000";
const LOCATION = "a2000000-0000-4000-8000-000000000001";
const APPROVAL = "d2000000-0000-4000-8000-000000000001";
const ADMIN = "a3000000-0000-4000-8000-000000000001";
const STAFF = "a3000000-0000-4000-8000-000000000004";
const WEB = "https://staging.moodlycrm.com";

function notification(overrides: Record<string, unknown> = {}) {
  return {
    approval: {
      id: APPROVAL,
      status: "pending",
      reason: "Responder: «Tenemos hueco el lunes a las 9:00»",
      created_at: "2026-11-10T09:30:00+00:00",
      expires_at: "2026-11-11T09:30:00+00:00",
      location_id: LOCATION,
    },
    agent: { display_name: null, type_key: "type-key", type_name: "Recepción" },
    organization: { default_locale: "es-ES" },
    location: { name: "Local A1", timezone: "Europe/Madrid" },
    recipients: [
      { user_id: ADMIN, email: "admin@example.test", locale: "es-ES" },
      { user_id: STAFF, email: "staff@example.test", locale: "en-GB" },
    ],
    ...overrides,
  };
}

function event(payload: Record<string, unknown> = { approval_id: APPROVAL }): DomainEvent {
  return {
    id: "e0000000-0000-4000-8000-000000000001",
    type: "approval.created",
    organizationId: ORG,
    locationId: LOCATION,
    payload,
    sourceRunId: null,
    chainDepth: 0,
    createdAt: "2026-11-10T09:30:00Z",
  };
}

function harness(data: unknown, send: (request: SendEmailRequest) => Promise<{ id: string }> = async () => ({ id: "x" })) {
  const lines: string[] = [];
  const logger = createLogger("debug", { write: (line: string) => void lines.push(line) });
  const loads: string[] = [];
  const sent: SendEmailRequest[] = [];
  const steps: { name: string; retry: StepRetry | undefined }[] = [];
  const db = {
    organizationId: ORG,
    approvalNotification: async (id: string) => {
      loads.push(id);
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

describe("emailLocale", () => {
  it("el idioma de la persona; si no es es/en, el de la organización; si no, español", () => {
    expect(emailLocale("en-GB", "es-ES")).toBe("en");
    expect(emailLocale("es-ES", "en-US")).toBe("es");
    expect(emailLocale("fr-FR", "en-US")).toBe("en");
    expect(emailLocale("fr-FR", "de-DE")).toBe("es");
    expect(emailLocale(null, null)).toBe("es");
  });
});

describe("approvalUrl", () => {
  it("lleva a /app/approvals con el local elegido; sin local, sin alcance", () => {
    expect(approvalUrl(WEB, LOCATION)).toBe(`${WEB}/app/approvals?scope=location%3A${LOCATION}`);
    expect(approvalUrl(WEB, null)).toBe(`${WEB}/app/approvals`);
  });
});

describe("buildApprovalEmails", () => {
  it("uno por persona, en su idioma, desde la dirección de avisos con BRAND_NAME y con su clave de idempotencia", () => {
    const emails = buildApprovalEmails(notification() as never, WEB);
    expect(emails.map((email) => email.userId)).toEqual([ADMIN, STAFF]);
    const [admin, staff] = emails;
    expect(admin?.request).toMatchObject({
      from: { email: NOTIFICATION_EMAIL_FROM, name: BRAND_NAME },
      to: "admin@example.test",
      idempotencyKey: `approval:${APPROVAL}:${ADMIN}`,
    });
    expect(admin?.request.subject).toBe("Recepción espera tu aprobación: Responder: «Tenemos hueco el lunes a las 9:00»");
    expect(admin?.request.text).toContain("Local A1");
    expect(admin?.request.text).toContain(approvalUrl(WEB, LOCATION));
    expect(staff?.request.to).toBe("staff@example.test");
    expect(staff?.request.idempotencyKey).toBe(`approval:${APPROVAL}:${STAFF}`);
    expect(staff?.request.subject).toBe("Recepción is waiting for your approval: Responder: «Tenemos hueco el lunes a las 9:00»");
  });

  it("el nombre propio del agente, si lo tiene", () => {
    const [email] = buildApprovalEmails(notification({ agent: { display_name: "Lucía", type_key: "type-key", type_name: "Recepción" } }) as never, WEB);
    expect(email?.request.subject).toMatch(/^Lucía espera tu aprobación/);
  });

  it("no repite a una persona aunque venga dos veces", () => {
    const twice = notification({
      recipients: [
        { user_id: ADMIN, email: "admin@example.test", locale: "es-ES" },
        { user_id: ADMIN, email: "admin@example.test", locale: "es-ES" },
      ],
    });
    expect(buildApprovalEmails(twice as never, WEB)).toHaveLength(1);
  });

  it("sin nadie que pueda decidir, ningún email", () => {
    expect(buildApprovalEmails(notification({ recipients: [] }) as never, WEB)).toEqual([]);
  });
});

describe("createApprovalEmailHandler", () => {
  it("se suscribe solo a approval.created, por la cola de avisos (no frena las respuestas a los clientes)", () => {
    const handler = createApprovalEmailHandler({ sender: null, webAppUrl: null });
    expect(handler.key).toBe(APPROVAL_EMAIL_HANDLER_KEY);
    expect(handler.eventTypes).toEqual(["approval.created"]);
    expect(handler.queue).toBe("notifications");
  });

  it("un error que no es agotar los reintentos no se traga: sube", async () => {
    const h = harness(notification());
    h.ctx.step = async (name) => {
      if (name.startsWith("send:")) throw new Error("fallo del motor");
      return notification() as never;
    };
    await expect(createApprovalEmailHandler({ sender: h.sender, webAppUrl: WEB }).handle(event(), h.ctx)).rejects.toThrow("fallo del motor");
  });

  it("envía un email a cada persona que da la base de datos, cada uno en su paso con reintentos", async () => {
    const h = harness(notification());
    await createApprovalEmailHandler({ sender: h.sender, webAppUrl: WEB }).handle(event(), h.ctx);
    expect(h.loads).toEqual([APPROVAL]);
    expect(h.sent.map((request) => request.to)).toEqual(["admin@example.test", "staff@example.test"]);
    expect(h.sent.map((request) => request.idempotencyKey)).toEqual([`approval:${APPROVAL}:${ADMIN}`, `approval:${APPROVAL}:${STAFF}`]);
    expect(h.steps).toEqual([
      { name: "load", retry: undefined },
      { name: `send:${ADMIN}`, retry: SEND_RETRY },
      { name: `send:${STAFF}`, retry: SEND_RETRY },
    ]);
  });

  it("los destinatarios nunca salen del payload: uno metido en el evento no recibe nada", async () => {
    const h = harness(notification({ recipients: [{ user_id: ADMIN, email: "admin@example.test", locale: "es-ES" }] }));
    const payload = { approval_id: APPROVAL, recipients: [{ email: "intruso@example.test" }], email: "intruso@example.test", organization_id: OTHER_ORG };
    await createApprovalEmailHandler({ sender: h.sender, webAppUrl: WEB }).handle(event(payload), h.ctx);
    expect(h.sent.map((request) => request.to)).toEqual(["admin@example.test"]);
  });

  it("sin clave de Resend no envía ni lee nada: registra un aviso y sigue", async () => {
    const h = harness(notification());
    await expect(createApprovalEmailHandler({ sender: null, webAppUrl: WEB }).handle(event(), h.ctx)).resolves.toBeUndefined();
    expect(h.loads).toEqual([]);
    expect(h.sent).toEqual([]);
    expect(h.lines.join("")).toContain("RESEND_API_KEY");
    expect(h.lines.map((line) => JSON.parse(line).level)).toEqual(["warn"]);
  });

  it("sin WEB_APP_URL tampoco envía", async () => {
    const h = harness(notification());
    await createApprovalEmailHandler({ sender: h.sender, webAppUrl: null }).handle(event(), h.ctx);
    expect(h.sent).toEqual([]);
    expect(h.lines.join("")).toContain("WEB_APP_URL");
  });

  it("una aprobación que ya no está pendiente, o que no es de la organización, no se avisa", async () => {
    for (const data of [notification({ approval: { ...notification().approval, status: "approved" } }), null]) {
      const h = harness(data);
      await createApprovalEmailHandler({ sender: h.sender, webAppUrl: WEB }).handle(event(), h.ctx);
      expect(h.sent).toEqual([]);
    }
  });

  it("SEND_RETRY aguanta una caída de Resend de varios minutos", () => {
    const { maxAttempts, intervalSeconds, backoffRate } = SEND_RETRY;
    const waited = Array.from({ length: maxAttempts - 1 }, (_, i) => intervalSeconds * backoffRate ** i).reduce((a, b) => a + b, 0);
    expect(waited).toBeGreaterThanOrEqual(10 * 60);
  });

  it("un rechazo definitivo de Resend no frena a los demás", async () => {
    const h = harness(notification(), async (request) => {
      if (request.to === "admin@example.test") throw new EmailSendError("Resend rechazó el email (422 validation_error)", 422, "rejected");
      return { id: "ok" };
    });
    await createApprovalEmailHandler({ sender: h.sender, webAppUrl: WEB }).handle(event(), h.ctx);
    expect(h.sent.map((request) => request.to)).toEqual(["admin@example.test", "staff@example.test"]);
    expect(h.lines.join("")).toMatch(/"rejected":1/);
  });

  it("un fallo pasajero se reintenta con la misma clave hasta que sale: una sola vez por persona", async () => {
    let failures = 0;
    const h = harness(notification(), async (request) => {
      if (request.to === "admin@example.test" && failures < 6) {
        failures += 1;
        throw new EmailSendError("Resend rechazó el email (503 application_error)", 503, "transient");
      }
      return { id: "ok" };
    });
    await createApprovalEmailHandler({ sender: h.sender, webAppUrl: WEB }).handle(event(), h.ctx);
    const admin = h.sent.filter((request) => request.to === "admin@example.test");
    expect(admin).toHaveLength(7);
    expect(new Set(admin.map((request) => request.idempotencyKey))).toEqual(new Set([`approval:${APPROVAL}:${ADMIN}`]));
    expect(h.sent.filter((request) => request.to === "staff@example.test")).toHaveLength(1);
    expect(h.lines.join("")).toMatch(/"sent":2/);
  });

  it("si agota los reintentos, ese no sale y los demás sí", async () => {
    const h = harness(notification(), async (request) => {
      if (request.to === "admin@example.test") throw new EmailSendError("Resend rechazó el email (503 application_error)", 503, "transient");
      return { id: "ok" };
    });
    const retry = { maxAttempts: 3, intervalSeconds: 0, backoffRate: 1 };
    await expect(createApprovalEmailHandler({ sender: h.sender, webAppUrl: WEB, retry }).handle(event(), h.ctx)).resolves.toBeUndefined();
    expect(h.sent.filter((request) => request.to === "admin@example.test")).toHaveLength(3);
    expect(h.sent.filter((request) => request.to === "staff@example.test")).toHaveLength(1);
    const logs = h.lines.map((line) => JSON.parse(line) as { level: string; msg: string; failed?: number; sent?: number });
    expect(logs.some((log) => log.level === "error" && /tras los reintentos/.test(log.msg))).toBe(true);
    expect(logs.at(-1)).toMatchObject({ failed: 1, sent: 1 });
  });

  it("un 401/403 no se reintenta, no se intenta con nadie más y deja un error con su evento de seguridad", async () => {
    const h = harness(notification(), async () => {
      throw new EmailSendError("Resend rechazó el email (401 missing_api_key)", 401, "unauthorized");
    });
    await createApprovalEmailHandler({ sender: h.sender, webAppUrl: WEB }).handle(event(), h.ctx);
    expect(h.sent).toHaveLength(1);
    const logs = h.lines.map((line) => JSON.parse(line) as { level: string; securityEvent?: string; skipped?: number; sent?: number });
    expect(logs.find((log) => log.securityEvent === EMAIL_UNAUTHORIZED_EVENT)).toMatchObject({ level: "error", skipped: 2 });
    expect(logs.at(-1)).toMatchObject({ sent: 0, skipped: 2 });
  });

  it("ningún email en los logs", async () => {
    const h = harness(notification(), async (request) => {
      if (request.to === "staff@example.test") throw new EmailSendError("Resend rechazó el email (422 validation_error)", 422, "rejected");
      return { id: "ok" };
    });
    await createApprovalEmailHandler({ sender: h.sender, webAppUrl: WEB }).handle(event(), h.ctx);
    const logs = h.lines.join("\n");
    expect(logs).toContain("avisos de aprobación enviados");
    expect(logs).not.toContain("@example.test");
  });
});
