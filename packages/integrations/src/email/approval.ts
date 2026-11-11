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

/** La de `locations.timezone` por defecto en la base de datos. */
const DEFAULT_TIME_ZONE = "Europe/Madrid";
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
  const created = formatCreatedAt(input.createdAt, input.locale, input.timeZone);
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

/** Solo un enlace a la app: https, o http a la máquina local para desarrollo. */
function appUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("El enlace de la aprobación no es una URL absoluta");
  }
  const local = url.protocol === "http:" && (url.hostname === "127.0.0.1" || url.hostname === "localhost");
  if (url.protocol !== "https:" && !local) throw new Error("El enlace de la aprobación tiene que ser https");
  return url.toString();
}

/** Sin saltos de línea ni caracteres de control (el asunto es una cabecera) y sin espacios repetidos. */
function oneLine(value: string): string {
  // eslint-disable-next-line no-control-regex -- quitar caracteres de control es justo el objetivo
  const CONTROL = /[\u0000-\u001F\u007F]+/g;
  return value.replace(CONTROL, " ").replace(/\s+/g, " ").trim();
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1).trimEnd()}…`;
}

function formatCreatedAt(iso: string, locale: EmailLocale, timeZone: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "numeric",
    year: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    timeZone: validTimeZone(timeZone),
    // Quien lee el email puede estar en otra zona: la hora lleva siempre la suya.
    timeZoneName: "short",
  }).format(new Date(iso));
}

function validTimeZone(value: string): string {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return value;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
