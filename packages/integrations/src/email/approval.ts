// El email de «una aprobación te espera» (auditoría de preproducción, M-02;
// decisión de producto 10: aviso por email al dueño). Función pura, sin I/O: el
// worker la llama al crearse una aprobación, con los datos ya leídos de la base
// de datos, y la envía. Nada del payload ni del modelo decide a quién se envía:
// eso lo hace el worker. La marca sale de BRAND_NAME (@repo/config): nunca se
// escribe a mano ni la elige quien llama.
//
// Lo que entra puede llevar texto del cliente (el resumen de lo que se aprueba):
// en el HTML se escapa todo, y el asunto queda en una sola línea corta.

import { BRAND_NAME } from "@repo/config";
import { appUrl, escapeHtml, formatLocalDateTime, oneLine, truncate } from "./format.js";

export type EmailLocale = "es" | "en";

export interface ApprovalEmailInput {
  locale: EmailLocale;
  /** El nombre del agente, como lo ve el dueño («Recepción»). */
  agentName: string;
  /** Lo que se aprueba, en una frase (la vista previa de la skill). Sin email ni teléfono del cliente. */
  summary: string;
  /** El local de la aprobación; null: de toda la organización. */
  locationName: string | null;
  /** Cuándo se creó (ISO). */
  createdAt: string;
  /** La zona horaria del local (IANA); si no vale, la de por defecto de los locales. */
  timeZone: string;
  /** El enlace absoluto a la aprobación en la app. */
  approvalUrl: string;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

const SUBJECT_MAX_LENGTH = 120;

const COPY: Record<
  EmailLocale,
  {
    subject: (agent: string, summary: string) => string;
    intro: (agent: string) => string;
    location: string;
    wholeOrganization: string;
    created: string;
    action: string;
    footer: (brand: string) => string;
  }
> = {
  es: {
    subject: (agent, summary) => `${agent} espera tu aprobación: ${summary}`,
    intro: (agent) => `${agent} ha preparado algo que necesita tu visto bueno antes de hacerse:`,
    location: "Local",
    wholeOrganization: "Toda la organización",
    created: "Creada",
    action: "Revisar y decidir",
    footer: (brand) => `Recibes este aviso porque puedes decidir las aprobaciones de este local en ${brand}.`,
  },
  en: {
    subject: (agent, summary) => `${agent} is waiting for your approval: ${summary}`,
    intro: (agent) => `${agent} has prepared something that needs your approval before it happens:`,
    location: "Location",
    wholeOrganization: "Whole organization",
    created: "Created",
    action: "Review and decide",
    footer: (brand) => `You get this notice because you can decide approvals for this location in ${brand}.`,
  },
};

export function renderApprovalEmail(input: ApprovalEmailInput): RenderedEmail {
  const url = appUrl(input.approvalUrl);
  const copy = COPY[input.locale];
  const agent = oneLine(input.agentName);
  const summary = oneLine(input.summary);
  const location = input.locationName ? oneLine(input.locationName) : copy.wholeOrganization;
  const created = formatLocalDateTime(input.createdAt, input.locale, input.timeZone);
  const brand = BRAND_NAME;

  const subject = truncate(copy.subject(agent, summary), SUBJECT_MAX_LENGTH);
  const text = [
    copy.intro(agent),
    "",
    summary,
    "",
    `${copy.location}: ${location}`,
    `${copy.created}: ${created}`,
    "",
    `${copy.action} (${brand}): ${url}`,
    "",
    copy.footer(brand),
  ].join("\n");

  const html = `<!doctype html>
<html lang="${input.locale}">
<body style="margin:0;padding:24px;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#111827;background:#ffffff">
<p style="margin:0 0 12px">${escapeHtml(copy.intro(agent))}</p>
<p style="margin:0 0 16px;padding:12px 16px;border-left:3px solid #111827;background:#f3f4f6">${escapeHtml(summary)}</p>
<p style="margin:0 0 4px;color:#4b5563">${escapeHtml(copy.location)}: ${escapeHtml(location)}</p>
<p style="margin:0 0 20px;color:#4b5563">${escapeHtml(copy.created)}: ${escapeHtml(created)}</p>
<p style="margin:0 0 24px"><a href="${escapeHtml(url)}" style="display:inline-block;padding:10px 16px;border-radius:6px;background:#111827;color:#ffffff;text-decoration:none">${escapeHtml(copy.action)}</a></p>
<p style="margin:0;font-size:12px;color:#6b7280">${escapeHtml(copy.footer(brand))}</p>
</body>
</html>`;

  return { subject, html, text };
}
