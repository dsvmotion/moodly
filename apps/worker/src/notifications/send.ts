import { EmailSendError, type EmailSender, type SendEmailRequest } from "@repo/integrations";
import { StepRetriesExhaustedError, type EventContext, type StepRetry } from "../events/handlers.ts";

// El envío de los emails de aviso (aprobaciones y tope mensual), uno por
// persona y cada uno en su paso de DBOS, con su clave de idempotencia en Resend:
//
// - Lo pasajero (red, 429, 5xx) lanza y DBOS lo reintenta con espera creciente
//   y la misma clave: un reintento no manda dos veces el mismo email.
// - Un 422 (una dirección que no vale) se registra y se sigue con los demás.
// - Si agota los reintentos, ese no sale y se sigue con los demás.
// - Un 401/403 es configuración (la clave o el dominio): no se reintenta, se
//   registra con su evento de seguridad y no se intenta con nadie más.
// - Ningún email en los logs: solo ids y recuentos (ADR 0032).

/**
 * Lo que se reintenta un envío que falla de forma pasajera: 10 intentos con
 * esperas de 2 s, 4 s, 8 s… 512 s, unos 17 minutos en total, para aguantar una
 * caída de Resend de unos minutos.
 */
export const SEND_RETRY: StepRetry = { maxAttempts: 10, intervalSeconds: 2, backoffRate: 2 };

/** El evento de seguridad de un 401/403 de Resend (ADR 0032): la clave o el dominio están mal. */
export const EMAIL_UNAUTHORIZED_EVENT = "email.provider_unauthorized";

export interface NoticeEmail {
  userId: string;
  request: SendEmailRequest;
}

export interface SendCounts {
  recipients: number;
  sent: number;
  rejected: number;
  failed: number;
  skipped: number;
}

type SendOutcome = "sent" | "rejected" | "unauthorized";

/**
 * Envía cada email en su paso (`send:<persona>`). `what` nombra el aviso en los
 * logs («aviso de aprobación»); `fields` son los ids que los acompañan.
 */
export async function sendNoticeEmails(
  ctx: EventContext,
  sender: EmailSender,
  emails: readonly NoticeEmail[],
  { retry, what, fields }: { retry: StepRetry; what: string; fields: Record<string, unknown> },
): Promise<SendCounts> {
  const counts: SendCounts = { recipients: emails.length, sent: 0, rejected: 0, failed: 0, skipped: 0 };
  for (const [index, email] of emails.entries()) {
    let outcome: SendOutcome;
    try {
      outcome = await ctx.step(
        `send:${email.userId}`,
        async (): Promise<SendOutcome> => {
          try {
            await sender.send(email.request);
            return "sent";
          } catch (err) {
            // Lo pasajero lanza: DBOS lo reintenta con la misma clave de idempotencia.
            if (err instanceof EmailSendError && err.kind === "unauthorized") return "unauthorized";
            if (err instanceof EmailSendError && err.kind === "rejected") {
              ctx.logger.warn({ ...fields, userId: email.userId, status: err.status }, `Resend rechazó el ${what}`);
              return "rejected";
            }
            throw err;
          }
        },
        retry,
      );
    } catch (err) {
      // Solo si agotó los reintentos: este no sale, los demás sí se intentan. Otro error, arriba.
      if (!(err instanceof StepRetriesExhaustedError)) throw err;
      ctx.logger.error({ ...fields, userId: email.userId }, `${what} sin enviar: Resend siguió fallando tras los reintentos`);
      counts.failed += 1;
      continue;
    }
    if (outcome === "unauthorized") {
      counts.skipped = emails.length - index;
      ctx.logger.error(
        { ...fields, securityEvent: EMAIL_UNAUTHORIZED_EVENT, skipped: counts.skipped },
        `Resend rechazó la clave o el remitente (401/403): no se envía ningún ${what} más`,
      );
      break;
    }
    if (outcome === "sent") counts.sent += 1;
    else counts.rejected += 1;
  }
  return counts;
}

/** es-ES → es, en-GB → en; lo demás, en el idioma de la organización y si no, español. */
export function emailLocale(userLocale: string | null | undefined, organizationLocale: string | null | undefined): "es" | "en" {
  for (const value of [userLocale, organizationLocale]) {
    const language = value?.toLowerCase().split(/[-_]/)[0];
    if (language === "es" || language === "en") return language;
  }
  return "es";
}
