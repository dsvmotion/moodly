import { BRAND_NAME, NOTIFICATION_EMAIL_FROM } from "@repo/config";
import type { TenantDb } from "@repo/db/service";
import type { EmailSender, SendEmailRequest } from "@repo/integrations";
import { describe, expect, it } from "vitest";
import { type DomainEvent, type EventContext, type StepRetry } from "../events/handlers.ts";
import { createLogger } from "../logger.ts";
import { SEND_RETRY } from "./approval-email.ts";
import { HANDOFF_EMAIL_HANDLER_KEY, buildHandoffEmails, conversationUrl, createHandoffEmailHandler } from "./handoff-email.ts";

// El aviso por email de un paso a una persona (CU3). Sin base de datos ni red:
// handoff_notification y Resend, falsos. A quién se envía lo decide la base de
// datos (47_conversation_handed_off): aquí, que el consumidor envía exactamente
// a quien le dio la base de datos, uno por persona, en su idioma y una sola vez
// por paso.

const ORG = "a0000000-0000-4000-8000-000000000000";
const OTHER_ORG = "b0000000-0000-4000-8000-000000000000";
const LOCATION = "a2000000-0000-4000-8000-000000000001";
const CONVERSATION = "f4000000-0000-4000-8000-000000000001";
const AGENT = "a5000000-0000-4000-8000-000000000001";
const EVENT = "e0000000-0000-4000-8000-000000000009";
const ADMIN = "a3000000-0000-4000-8000-000000000001";
const STAFF = "a3000000-0000-4000-8000-000000000004";
const WEB = "https://staging.moodlycrm.com";

function notification(overrides: Record<string, unknown> = {}) {
  return {
    conversation: { id: CONVERSATION, mode: "human", channel: "whatsapp", location_id: LOCATION },
    contact: { display_name: "Ana" },
    agent: { display_name: null, type_key: "type-key", type_name: "Atención al cliente" },
    organization: { default_locale: "es-ES" },
    location: { name: "Local A1", timezone: "Europe/Madrid" },
    recipients: [
      { user_id: ADMIN, email: "admin@example.test", locale: "es-ES" },
      { user_id: STAFF, email: "staff@example.test", locale: "en-GB" },
    ],
    ...overrides,
  };
}

function event(payload: Record<string, unknown> = { conversation_id: CONVERSATION, agent_id: AGENT }): DomainEvent {
  return {
    id: EVENT,
    type: "conversation.handed_off",
    organizationId: ORG,
    locationId: LOCATION,
    payload,
    sourceRunId: null,
    chainDepth: 0,
    createdAt: "2026-11-10T09:30:00Z",
  };
}

function harness(data: unknown) {
  const lines: string[] = [];
  const logger = createLogger("debug", { write: (line: string) => void lines.push(line) });
  const loads: string[] = [];
  const sent: SendEmailRequest[] = [];
  const steps: { name: string; retry: StepRetry | undefined }[] = [];
  const db = {
    organizationId: ORG,
    handoffNotification: async (id: string) => {
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
      return { id: "x" };
    },
  };
  return { ctx, sender, sent, loads, steps, lines };
}

describe("conversationUrl", () => {
  it("lleva a la conversación en la bandeja con el local elegido; sin local, sin alcance", () => {
    expect(conversationUrl(WEB, CONVERSATION, LOCATION)).toBe(`${WEB}/app/inbox/${CONVERSATION}?scope=location%3A${LOCATION}`);
    expect(conversationUrl(WEB, CONVERSATION, null)).toBe(`${WEB}/app/inbox/${CONVERSATION}`);
  });
});

describe("buildHandoffEmails", () => {
  it("uno por persona, en su idioma, desde la dirección de avisos con BRAND_NAME y con su clave de idempotencia por paso", () => {
    const emails = buildHandoffEmails(notification() as never, event(), WEB);
    expect(emails.map((email) => email.userId)).toEqual([ADMIN, STAFF]);
    const [admin, staff] = emails;
    expect(admin?.request).toMatchObject({
      from: { email: NOTIFICATION_EMAIL_FROM, name: BRAND_NAME },
      to: "admin@example.test",
      idempotencyKey: `handoff:${EVENT}:${ADMIN}`,
    });
    expect(admin?.request.subject).toBe("Atención al cliente ha pasado una conversación al equipo (Local A1)");
    expect(admin?.request.text).toContain("Cliente: Ana");
    expect(admin?.request.text).toContain("Canal: WhatsApp");
    expect(admin?.request.text).toContain("10/11/26, 10:30 CET");
    expect(admin?.request.text).toContain(conversationUrl(WEB, CONVERSATION, LOCATION));
    expect(staff?.request.to).toBe("staff@example.test");
    expect(staff?.request.idempotencyKey).toBe(`handoff:${EVENT}:${STAFF}`);
    expect(staff?.request.subject).toBe("Atención al cliente handed a conversation to the team (Local A1)");
  });

  it("el nombre propio del agente, si lo tiene", () => {
    const [email] = buildHandoffEmails(
      notification({ agent: { display_name: "Lucía", type_key: "type-key", type_name: "Atención al cliente" } }) as never,
      event(),
      WEB,
    );
    expect(email?.request.subject).toMatch(/^Lucía ha pasado una conversación/);
  });

  it("no repite a una persona aunque venga dos veces", () => {
    const twice = notification({
      recipients: [
        { user_id: ADMIN, email: "admin@example.test", locale: "es-ES" },
        { user_id: ADMIN, email: "admin@example.test", locale: "es-ES" },
      ],
    });
    expect(buildHandoffEmails(twice as never, event(), WEB)).toHaveLength(1);
  });
});

describe("createHandoffEmailHandler", () => {
  it("se suscribe solo a conversation.handed_off, por la cola de avisos (no frena las respuestas a los clientes)", () => {
    const handler = createHandoffEmailHandler({ sender: null, webAppUrl: null });
    expect(handler.key).toBe(HANDOFF_EMAIL_HANDLER_KEY);
    expect(handler.eventTypes).toEqual(["conversation.handed_off"]);
    expect(handler.queue).toBe("notifications");
  });

  it("envía un email a cada persona que da la base de datos, cada uno en su paso con reintentos", async () => {
    const h = harness(notification());
    await createHandoffEmailHandler({ sender: h.sender, webAppUrl: WEB }).handle(event(), h.ctx);
    expect(h.loads).toEqual([CONVERSATION]);
    expect(h.sent.map((request) => request.to)).toEqual(["admin@example.test", "staff@example.test"]);
    expect(h.steps).toEqual([
      { name: "load", retry: undefined },
      { name: `send:${ADMIN}`, retry: SEND_RETRY },
      { name: `send:${STAFF}`, retry: SEND_RETRY },
    ]);
  });

  it("no lleva el contenido de los mensajes: ni el texto ni el HTML", async () => {
    const h = harness(notification({ last_message: { content: "Mi DNI es 12345678Z" } }));
    await createHandoffEmailHandler({ sender: h.sender, webAppUrl: WEB }).handle(event(), h.ctx);
    for (const request of h.sent) {
      expect(request.text).not.toContain("12345678Z");
      expect(request.html).not.toContain("12345678Z");
    }
  });

  it("los destinatarios y la organización nunca salen del payload", async () => {
    const h = harness(notification({ recipients: [{ user_id: ADMIN, email: "admin@example.test", locale: "es-ES" }] }));
    const payload = { conversation_id: CONVERSATION, agent_id: AGENT, recipients: [{ email: "intruso@example.test" }], organization_id: OTHER_ORG };
    await createHandoffEmailHandler({ sender: h.sender, webAppUrl: WEB }).handle(event(payload), h.ctx);
    expect(h.sent.map((request) => request.to)).toEqual(["admin@example.test"]);
  });

  it("si ya la han devuelto al agente (o cerrado), no avisa: no hay nada que llevar", async () => {
    for (const mode of ["agent", "closed"]) {
      const h = harness(notification({ conversation: { id: CONVERSATION, mode, channel: "whatsapp", location_id: LOCATION } }));
      await createHandoffEmailHandler({ sender: h.sender, webAppUrl: WEB }).handle(event(), h.ctx);
      expect(h.sent).toEqual([]);
      expect(h.lines.join("")).toContain("ya no está en manos del equipo");
    }
  });

  it("un paso en el chat de pruebas de la app (canal test) no avisa a nadie por email (V10)", async () => {
    const h = harness(notification({ conversation: { id: CONVERSATION, mode: "human", channel: "test", location_id: LOCATION } }));
    await createHandoffEmailHandler({ sender: h.sender, webAppUrl: WEB }).handle(event(), h.ctx);
    expect(h.sent).toEqual([]);
    expect(h.lines.join("")).toContain("chat de pruebas");
  });

  it("una conversación que no está en su organización: no envía nada", async () => {
    const h = harness(null);
    await createHandoffEmailHandler({ sender: h.sender, webAppUrl: WEB }).handle(event(), h.ctx);
    expect(h.sent).toEqual([]);
  });

  it("lo que devuelve la base de datos se valida: algo inesperado no se envía", async () => {
    const h = harness({ conversation: { id: CONVERSATION } });
    await createHandoffEmailHandler({ sender: h.sender, webAppUrl: WEB }).handle(event(), h.ctx);
    expect(h.sent).toEqual([]);
    expect(h.lines.map((line) => JSON.parse(line).level)).toContain("error");
  });

  it("sin clave de Resend o sin WEB_APP_URL no envía ni lee nada: registra un aviso y sigue", async () => {
    for (const options of [{ sender: null, webAppUrl: WEB }, { sender: harness(null).sender, webAppUrl: null }]) {
      const h = harness(notification());
      await expect(createHandoffEmailHandler(options).handle(event(), h.ctx)).resolves.toBeUndefined();
      expect(h.loads).toEqual([]);
      expect(h.lines.map((line) => JSON.parse(line).level)).toEqual(["warn"]);
    }
  });

  it("ningún email en los logs: solo ids y recuentos", async () => {
    const h = harness(notification());
    await createHandoffEmailHandler({ sender: h.sender, webAppUrl: WEB }).handle(event(), h.ctx);
    expect(h.lines.join("")).not.toContain("@example.test");
    expect(h.lines.join("")).not.toContain("Ana");
  });
});
