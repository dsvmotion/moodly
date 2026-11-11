import { BRAND_NAME, NOTIFICATION_EMAIL_FROM } from "@repo/config";
import type { TenantDb } from "@repo/db/service";
import { EmailSendError, type EmailSender, type SendEmailRequest } from "@repo/integrations";
import { describe, expect, it } from "vitest";
import type { DomainEvent, EventContext, StepRetry } from "../events/handlers.ts";
import { createLogger } from "../logger.ts";
import {
  APPROVAL_EMAIL_HANDLER_KEY,
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
    step: async (name, fn, retry) => {
      steps.push({ name, retry });
      return fn();
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
  it("se suscribe solo a approval.created", () => {
    const handler = createApprovalEmailHandler({ sender: null, webAppUrl: null });
    expect(handler.key).toBe(APPROVAL_EMAIL_HANDLER_KEY);
    expect(handler.eventTypes).toEqual(["approval.created"]);
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

  it("un rechazo definitivo de Resend no frena a los demás; uno pasajero lanza para que DBOS lo reintente", async () => {
    const rejected = harness(notification(), async (request) => {
      if (request.to === "admin@example.test") throw new EmailSendError("Resend rechazó el email (422 validation_error)", 422, false);
      return { id: "ok" };
    });
    await createApprovalEmailHandler({ sender: rejected.sender, webAppUrl: WEB }).handle(event(), rejected.ctx);
    expect(rejected.sent.map((request) => request.to)).toEqual(["admin@example.test", "staff@example.test"]);

    const transient = harness(notification(), async () => {
      throw new EmailSendError("Resend rechazó el email (503 application_error)", 503, true);
    });
    await expect(createApprovalEmailHandler({ sender: transient.sender, webAppUrl: WEB }).handle(event(), transient.ctx)).rejects.toThrow(
      EmailSendError,
    );
  });

  it("ningún email en los logs", async () => {
    const h = harness(notification(), async (request) => {
      if (request.to === "staff@example.test") throw new EmailSendError("Resend rechazó el email (422 validation_error)", 422, false);
      return { id: "ok" };
    });
    await createApprovalEmailHandler({ sender: h.sender, webAppUrl: WEB }).handle(event(), h.ctx);
    const logs = h.lines.join("\n");
    expect(logs).toContain("avisos de aprobación enviados");
    expect(logs).not.toContain("@example.test");
  });
});
