import { BRAND_NAME, NOTIFICATION_EMAIL_FROM } from "@repo/config";
import { renderBudgetEmail, type EmailSender } from "@repo/integrations";
import { z } from "zod";
import type { DomainEvent, EventContext, EventHandler, StepRetry } from "../events/handlers.ts";
import { emailLocale, sendNoticeEmails, SEND_RETRY, type NoticeEmail } from "./send.ts";

// El email de los avisos del tope mensual de IA al 80 % y al 100 % (PL-ledger,
// MANUAL §15.1; producto, 2026-11-12: email a los org_admin; el aviso en la
// app llega con el centro de avisos).
//
// - Lo provoca usage.budget_threshold, que escribe check_budget_thresholds una
//   sola vez por organización, mes y umbral (la base de datos lo garantiza).
// - A quién: solo de la base de datos (budget_notification: los org_admin), con
//   la organización de la fila del evento. Del payload solo salen el mes y el
//   umbral, validados, y con ellos se busca el aviso de esa organización.
// - Cada envío es un paso con su clave de idempotencia en Resend,
//   budget:<organización>:<mes>:<umbral>:<persona>: un reintento no manda dos
//   veces el mismo email. El resto (reintentos, 422, 401/403), como el aviso de
//   aprobaciones (send.ts).
// - Por la cola de avisos (notifications). Sin RESEND_API_KEY o sin
//   WEB_APP_URL no se envía nada: se registra y se sigue.

export const BUDGET_EMAIL_HANDLER_KEY = "notify.budget_email";

const payloadSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}-01$/),
  threshold: z.union([z.literal(80), z.literal(100)]),
});

const notificationSchema = z.object({
  organization: z.object({ name: z.string(), default_locale: z.string() }),
  notice: z.object({
    month: z.string(),
    threshold: z.union([z.literal(80), z.literal(100)]),
    spent_eur: z.coerce.number().nonnegative(),
    budget_eur: z.coerce.number().positive(),
  }),
  recipients: z.array(z.object({ user_id: z.uuid(), email: z.string().min(3), locale: z.string() })),
});

type Notification = z.infer<typeof notificationSchema>;

/**
 * El enlace del aviso: el inicio de la app. Los ajustes de modelos (donde irá el
 * tope del mes) aún no existen, y un email no lleva enlaces rotos.
 */
export function budgetLinkUrl(webAppUrl: string): string {
  return new URL("/app", webAppUrl).toString();
}

/** Un email por org_admin (sin repetir), en su idioma. Función pura: lo que se envía, sin enviarlo. */
export function buildBudgetEmails(organizationId: string, notification: Notification, webAppUrl: string): NoticeEmail[] {
  const { notice } = notification;
  const link = budgetLinkUrl(webAppUrl);
  const seen = new Set<string>();
  const emails: NoticeEmail[] = [];
  for (const recipient of notification.recipients) {
    if (seen.has(recipient.user_id)) continue;
    seen.add(recipient.user_id);
    const rendered = renderBudgetEmail({
      locale: emailLocale(recipient.locale, notification.organization.default_locale),
      organizationName: notification.organization.name,
      threshold: notice.threshold,
      spentEur: notice.spent_eur,
      budgetEur: notice.budget_eur,
      month: notice.month,
      appUrl: link,
    });
    emails.push({
      userId: recipient.user_id,
      request: {
        from: { email: NOTIFICATION_EMAIL_FROM, name: BRAND_NAME },
        to: recipient.email,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        idempotencyKey: `budget:${organizationId}:${notice.month}:${notice.threshold}:${recipient.user_id}`,
      },
    });
  }
  return emails;
}

export interface BudgetEmailHandlerOptions {
  /** null: sin RESEND_API_KEY. */
  sender: EmailSender | null;
  /** null: sin WEB_APP_URL. */
  webAppUrl: string | null;
  /** Los reintentos de cada envío; SEND_RETRY si no se dice (los tests de integración los acortan). */
  retry?: StepRetry;
}

export function createBudgetEmailHandler({ sender, webAppUrl, retry = SEND_RETRY }: BudgetEmailHandlerOptions): EventHandler {
  return {
    key: BUDGET_EMAIL_HANDLER_KEY,
    eventTypes: ["usage.budget_threshold"],
    queue: "notifications",
    async handle(event: DomainEvent, ctx: EventContext) {
      const payload = payloadSchema.safeParse(event.payload);
      if (!payload.success) {
        ctx.logger.error({ eventId: event.id }, "aviso del tope: el evento no trae un mes y un umbral válidos");
        return;
      }
      const { month, threshold } = payload.data;
      const fields = { month, threshold };
      if (!sender || !webAppUrl) {
        ctx.logger.warn({ ...fields, missing: !sender ? "RESEND_API_KEY" : "WEB_APP_URL" }, "aviso del tope sin enviar: falta configuración");
        return;
      }
      const raw = await ctx.step("load", () => ctx.db.budgetNotification(month, threshold));
      if (!raw) {
        ctx.logger.warn(fields, "aviso del tope: no está en su organización");
        return;
      }
      const parsed = notificationSchema.safeParse(raw);
      if (!parsed.success) {
        ctx.logger.error(fields, "aviso del tope: budget_notification devolvió algo inesperado");
        return;
      }
      const emails = buildBudgetEmails(event.organizationId, parsed.data, webAppUrl);
      const counts = await sendNoticeEmails(ctx, sender, emails, { retry, what: "aviso del tope", fields });
      ctx.logger.info({ ...fields, ...counts }, "avisos del tope enviados");
    },
  };
}
