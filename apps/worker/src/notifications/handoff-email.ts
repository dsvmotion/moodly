import { BRAND_NAME, NOTIFICATION_EMAIL_FROM } from "@repo/config";
import { renderHandoffEmail, type EmailSender } from "@repo/integrations";
import { z } from "zod";
import type { DomainEvent, EventContext, EventHandler, StepRetry } from "../events/handlers.ts";
import { emailLocale, sendNoticeEmails, SEND_RETRY, type NoticeEmail } from "./send.ts";

// El aviso por email de un paso a una persona (CU3): «<agente> ha pasado una
// conversación al equipo», a cada persona que puede llevarla.
//
// - Lo dispara conversation.handed_off, que escribe la base de datos al pasar
//   la conversación de 'agent' a 'human' por la plataforma, sea cual sea la
//   causa (20261112200000). Una persona que toma el control no lo dispara.
// - A quién: solo de la base de datos (handoff_notification, con la regla de
//   can_see_scope), con la organización de la fila del evento. Nunca del
//   payload ni de lo que genere el modelo.
// - Uno por paso: la clave de idempotencia en Resend es la del evento y la
//   persona, handoff:<evento>:<persona>. Un reintento o una entrega reanudada
//   no manda dos veces el mismo email; un paso nuevo (devuelta al agente y
//   pasada otra vez) es otro evento y otro aviso.
// - Si cuando llega el aviso ya la han devuelto al agente o cerrado, no se
//   envía: no hay nada que llevar.
// - Sin el contenido de los mensajes (V1): el agente, el cliente, el canal, el
//   local y la hora. Ningún email ni nombre en los logs: solo ids y recuentos.
// - Lo demás, como el aviso de las aprobaciones (send.ts): cola de avisos,
//   reintentos con espera creciente, 401/403 como configuración, y sin
//   RESEND_API_KEY o sin WEB_APP_URL no se envía nada.

export const HANDOFF_EMAIL_HANDLER_KEY = "notify.handoff_email";

const notificationSchema = z.object({
  conversation: z.object({ id: z.uuid(), mode: z.string(), channel: z.string().nullable(), location_id: z.uuid().nullable() }),
  contact: z.object({ display_name: z.string().nullable() }),
  agent: z.object({ display_name: z.string().nullable(), type_key: z.string(), type_name: z.string() }),
  organization: z.object({ default_locale: z.string() }),
  location: z.object({ name: z.string(), timezone: z.string() }).nullable(),
  recipients: z.array(z.object({ user_id: z.uuid(), email: z.string().min(3), locale: z.string() })),
});

type Notification = z.infer<typeof notificationSchema>;

/** El nombre del agente como lo ve el dueño: el suyo propio o el de su tipo (ADR 0030 §1). */
function agentName(agent: Notification["agent"]): string {
  return agent.display_name?.trim() || agent.type_name;
}

/** El enlace a la conversación en la bandeja, con el local ya elegido en el selector de alcance. */
export function conversationUrl(webAppUrl: string, conversationId: string, locationId: string | null): string {
  const url = new URL(`/app/inbox/${conversationId}`, webAppUrl);
  if (locationId) url.searchParams.set("scope", `location:${locationId}`);
  return url.toString();
}

/** Un email por persona (sin repetir), en su idioma. Función pura: lo que se envía, sin enviarlo. */
export function buildHandoffEmails(notification: Notification, event: DomainEvent, webAppUrl: string): NoticeEmail[] {
  const { conversation, location } = notification;
  const link = conversationUrl(webAppUrl, conversation.id, conversation.location_id);
  const seen = new Set<string>();
  const emails: NoticeEmail[] = [];
  for (const recipient of notification.recipients) {
    if (seen.has(recipient.user_id)) continue;
    seen.add(recipient.user_id);
    const rendered = renderHandoffEmail({
      locale: emailLocale(recipient.locale, notification.organization.default_locale),
      agentName: agentName(notification.agent),
      customerName: notification.contact.display_name,
      channel: conversation.channel,
      locationName: location?.name ?? null,
      handedOffAt: event.createdAt,
      timeZone: location?.timezone ?? "Europe/Madrid",
      conversationUrl: link,
    });
    emails.push({
      userId: recipient.user_id,
      request: {
        from: { email: NOTIFICATION_EMAIL_FROM, name: BRAND_NAME },
        to: recipient.email,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        idempotencyKey: `handoff:${event.id}:${recipient.user_id}`,
      },
    });
  }
  return emails;
}

export interface HandoffEmailHandlerOptions {
  /** null: sin RESEND_API_KEY. */
  sender: EmailSender | null;
  /** null: sin WEB_APP_URL. */
  webAppUrl: string | null;
  /** Los reintentos de cada envío; SEND_RETRY si no se dice. */
  retry?: StepRetry;
}

export function createHandoffEmailHandler({ sender, webAppUrl, retry = SEND_RETRY }: HandoffEmailHandlerOptions): EventHandler {
  return {
    key: HANDOFF_EMAIL_HANDLER_KEY,
    eventTypes: ["conversation.handed_off"],
    // Su propia cola, como el de las aprobaciones: con Resend caído, los
    // reintentos no ocupan los huecos de las respuestas a los clientes.
    queue: "notifications",
    async handle(event: DomainEvent, ctx: EventContext) {
      const conversationId = String(event.payload["conversation_id"]);
      if (!sender || !webAppUrl) {
        ctx.logger.warn({ conversationId, missing: !sender ? "RESEND_API_KEY" : "WEB_APP_URL" }, "aviso de paso sin enviar: falta configuración");
        return;
      }
      const raw = await ctx.step("load", () => ctx.db.handoffNotification(conversationId));
      if (!raw) {
        ctx.logger.warn({ conversationId }, "aviso de paso: la conversación no está en su organización");
        return;
      }
      const parsed = notificationSchema.safeParse(raw);
      if (!parsed.success) {
        ctx.logger.error({ conversationId }, "aviso de paso: handoff_notification devolvió algo inesperado");
        return;
      }
      if (parsed.data.conversation.mode !== "human") {
        ctx.logger.info({ conversationId, mode: parsed.data.conversation.mode }, "aviso de paso: ya no está en manos del equipo");
        return;
      }
      const emails = buildHandoffEmails(parsed.data, event, webAppUrl);
      const counts = await sendNoticeEmails(ctx, sender, emails, { retry, what: "aviso de paso", fields: { conversationId } });
      ctx.logger.info({ conversationId, ...counts }, "avisos de paso enviados");
    },
  };
}
