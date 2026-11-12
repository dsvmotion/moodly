import { BRAND_NAME, NOTIFICATION_EMAIL_FROM } from "@repo/config";
import { renderApprovalEmail, type EmailSender } from "@repo/integrations";
import { z } from "zod";
import type { DomainEvent, EventContext, EventHandler, StepRetry } from "../events/handlers.ts";
import { emailLocale, sendNoticeEmails, SEND_RETRY, type NoticeEmail } from "./send.ts";

export { EMAIL_UNAUTHORIZED_EVENT, SEND_RETRY, emailLocale } from "./send.ts";

// El aviso por email de una aprobación nueva (auditoría de preproducción, M-02;
// decisión de producto 10): «una aprobación te espera», a cada persona que
// puede decidirla.
//
// - A quién: solo de la base de datos (approval_notification, con la regla de
//   can_decide_approval), con la organización de la fila del evento. Nunca del
//   payload ni de lo que genere el modelo.
// - Cada envío es un paso (DBOS) con su clave de idempotencia en Resend,
//   approval:<aprobación>:<persona>: un reintento o una entrega reanudada no
//   manda dos veces el mismo email. Un fallo pasajero (red, 429, 5xx) se
//   reintenta con espera creciente, lo bastante para aguantar una caída de
//   unos minutos de Resend (SEND_RETRY). Si aun así no sale, o Resend rechaza
//   ese email (una dirección que no vale), se registra y se sigue con los
//   demás: el fallo de uno no se lleva a los siguientes.
// - Va por la cola de avisos (notifications), no por la de eventos de dominio:
//   mientras reintenta, no frena las respuestas a los clientes.
// - Un 401/403 es configuración (la clave o el dominio), no algo pasajero: no
//   se reintenta, se registra como error con su evento de seguridad y no se
//   intenta con nadie más, porque fallaría igual.
// - Sin RESEND_API_KEY o sin WEB_APP_URL no se envía nada: se registra un aviso
//   y se sigue (como sin AI_GATEWAY_API_KEY).
// - Ningún email en los logs: solo ids y recuentos (ADR 0032).

export const APPROVAL_EMAIL_HANDLER_KEY = "notify.approval_email";

const notificationSchema = z.object({
  approval: z.object({
    id: z.uuid(),
    status: z.string(),
    reason: z.string().nullable(),
    created_at: z.string(),
    location_id: z.uuid().nullable(),
  }),
  agent: z.object({ display_name: z.string().nullable(), type_key: z.string(), type_name: z.string() }),
  organization: z.object({ default_locale: z.string() }),
  location: z.object({ name: z.string(), timezone: z.string() }).nullable(),
  recipients: z.array(z.object({ user_id: z.uuid(), email: z.string().min(3), locale: z.string() })),
});

type Notification = z.infer<typeof notificationSchema>;

/**
 * El nombre del agente como lo ve el dueño: el suyo propio o el de su tipo, de
 * la base de datos (ADR 0030 §1: sin lógica sobre la clave del tipo). El del
 * tipo está en un solo idioma hasta que agent_types tenga traducciones.
 */
function agentName(agent: Notification["agent"]): string {
  return agent.display_name?.trim() || agent.type_name;
}

/** El enlace a las aprobaciones, con el local ya elegido en el selector de alcance. */
export function approvalUrl(webAppUrl: string, locationId: string | null): string {
  const url = new URL("/app/approvals", webAppUrl);
  if (locationId) url.searchParams.set("scope", `location:${locationId}`);
  return url.toString();
}

export type ApprovalEmail = NoticeEmail;

/** Un email por persona (sin repetir), en su idioma. Función pura: lo que se envía, sin enviarlo. */
export function buildApprovalEmails(notification: Notification, webAppUrl: string): ApprovalEmail[] {
  const { approval, location } = notification;
  const link = approvalUrl(webAppUrl, approval.location_id);
  const seen = new Set<string>();
  const emails: ApprovalEmail[] = [];
  for (const recipient of notification.recipients) {
    if (seen.has(recipient.user_id)) continue;
    seen.add(recipient.user_id);
    const locale = emailLocale(recipient.locale, notification.organization.default_locale);
    const rendered = renderApprovalEmail({
      locale,
      agentName: agentName(notification.agent),
      summary: approval.reason ?? "",
      locationName: location?.name ?? null,
      createdAt: approval.created_at,
      timeZone: location?.timezone ?? "Europe/Madrid",
      approvalUrl: link,
    });
    emails.push({
      userId: recipient.user_id,
      request: {
        from: { email: NOTIFICATION_EMAIL_FROM, name: BRAND_NAME },
        to: recipient.email,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        idempotencyKey: `approval:${approval.id}:${recipient.user_id}`,
      },
    });
  }
  return emails;
}

export interface ApprovalEmailHandlerOptions {
  /** null: sin RESEND_API_KEY. */
  sender: EmailSender | null;
  /** null: sin WEB_APP_URL. */
  webAppUrl: string | null;
  /** Los reintentos de cada envío; SEND_RETRY si no se dice (los tests de integración los acortan). */
  retry?: StepRetry;
}

export function createApprovalEmailHandler({ sender, webAppUrl, retry = SEND_RETRY }: ApprovalEmailHandlerOptions): EventHandler {
  return {
    key: APPROVAL_EMAIL_HANDLER_KEY,
    eventTypes: ["approval.created"],
    // Su propia cola: con Resend caído, los reintentos (minutos) no ocupan los
    // huecos de las entregas que contestan a los clientes (message.received).
    queue: "notifications",
    async handle(event: DomainEvent, ctx: EventContext) {
      const approvalId = String(event.payload["approval_id"]);
      if (!sender || !webAppUrl) {
        ctx.logger.warn({ approvalId, missing: !sender ? "RESEND_API_KEY" : "WEB_APP_URL" }, "aviso de aprobación sin enviar: falta configuración");
        return;
      }
      const raw = await ctx.step("load", () => ctx.db.approvalNotification(approvalId));
      if (!raw) {
        ctx.logger.warn({ approvalId }, "aviso de aprobación: la aprobación no está en su organización");
        return;
      }
      const parsed = notificationSchema.safeParse(raw);
      if (!parsed.success) {
        ctx.logger.error({ approvalId }, "aviso de aprobación: approval_notification devolvió algo inesperado");
        return;
      }
      // Ya decidida o caducada antes de llegar aquí: no hay nada que avisar.
      if (parsed.data.approval.status !== "pending") {
        ctx.logger.info({ approvalId, status: parsed.data.approval.status }, "aviso de aprobación: ya no está pendiente");
        return;
      }
      const emails = buildApprovalEmails(parsed.data, webAppUrl);
      const counts = await sendNoticeEmails(ctx, sender, emails, { retry, what: "aviso de aprobación", fields: { approvalId } });
      ctx.logger.info({ approvalId, ...counts }, "avisos de aprobación enviados");
    },
  };
}
