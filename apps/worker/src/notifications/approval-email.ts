import { BRAND_NAME, NOTIFICATION_EMAIL_FROM } from "@repo/config";
import { EmailSendError, renderApprovalEmail, type EmailLocale, type EmailSender, type SendEmailRequest } from "@repo/integrations";
import { z } from "zod";
import type { DomainEvent, EventContext, EventHandler, StepRetry } from "../events/handlers.ts";

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
//   reintenta; uno definitivo (una dirección que Resend rechaza) se registra y
//   no frena los demás envíos.
// - Sin RESEND_API_KEY o sin WEB_APP_URL no se envía nada: se registra un aviso
//   y se sigue (como sin AI_GATEWAY_API_KEY).
// - Ningún email en los logs: solo ids y recuentos (ADR 0032).

export const APPROVAL_EMAIL_HANDLER_KEY = "notify.approval_email";

/** Lo que se reintenta un envío que falla de forma pasajera: 1 s, 2 s, 4 s, 8 s. */
export const SEND_RETRY: StepRetry = { maxAttempts: 5, intervalSeconds: 1, backoffRate: 2 };

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

/** es-ES → es, en-GB → en; lo demás, en el idioma de la organización y si no, español. */
export function emailLocale(userLocale: string | null | undefined, organizationLocale: string | null | undefined): EmailLocale {
  for (const value of [userLocale, organizationLocale]) {
    const language = value?.toLowerCase().split(/[-_]/)[0];
    if (language === "es" || language === "en") return language;
  }
  return "es";
}

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

export interface ApprovalEmail {
  userId: string;
  request: SendEmailRequest;
}

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
}

type SendOutcome = "sent" | "rejected";

export function createApprovalEmailHandler({ sender, webAppUrl }: ApprovalEmailHandlerOptions): EventHandler {
  return {
    key: APPROVAL_EMAIL_HANDLER_KEY,
    eventTypes: ["approval.created"],
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
      let sent = 0;
      let rejected = 0;
      for (const email of emails) {
        const outcome = await ctx.step(
          `send:${email.userId}`,
          async (): Promise<SendOutcome> => {
            try {
              await sender.send(email.request);
              return "sent";
            } catch (err) {
              // Lo pasajero lanza: DBOS lo reintenta con la misma clave de idempotencia.
              if (err instanceof EmailSendError && !err.retryable) {
                ctx.logger.warn({ approvalId, userId: email.userId, status: err.status }, "Resend rechazó el aviso de aprobación");
                return "rejected";
              }
              throw err;
            }
          },
          SEND_RETRY,
        );
        if (outcome === "sent") sent += 1;
        else rejected += 1;
      }
      ctx.logger.info({ approvalId, recipients: emails.length, sent, rejected }, "avisos de aprobación enviados");
    },
  };
}
