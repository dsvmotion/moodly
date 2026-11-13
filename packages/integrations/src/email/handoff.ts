// El email de «te han pasado una conversación» (CU3): el agente ha dejado de
// contestar en una conversación y la ha pasado al equipo. Función pura, sin
// I/O: el worker la llama con los datos ya leídos de la base de datos
// (handoff_notification) y la envía. Nada del payload ni del modelo decide a
// quién se envía: eso lo hace el worker. La marca sale de BRAND_NAME.
//
// - Sin el contenido de los mensajes (V1): el agente, el cliente, el canal, el
//   local y la hora. Lo demás se lee en la bandeja, con la sesión.
// - El nombre del cliente lo escribe el cliente (o sale de su perfil): se
//   escapa en el HTML y no va en el asunto, que solo lleva el agente y el local.

import { BRAND_NAME } from "@repo/config";
import type { EmailLocale, RenderedEmail } from "./approval.js";
import { appUrl, escapeHtml, formatLocalDateTime, oneLine, truncate } from "./format.js";

export interface HandoffEmailInput {
  locale: EmailLocale;
  /** El nombre del agente, como lo ve el dueño («Atención al cliente»). */
  agentName: string;
  /** El nombre del cliente; null: sin nombre. */
  customerName: string | null;
  /** El canal de la conversación (conversations.channel); uno que no se conoce no se escribe. */
  channel: string | null;
  /** El local de la conversación; null: de toda la organización. */
  locationName: string | null;
  /** Cuándo se pasó (ISO). */
  handedOffAt: string;
  /** La zona horaria del local (IANA); si no vale, la de por defecto de los locales. */
  timeZone: string;
  /** El enlace absoluto a la conversación en la bandeja. */
  conversationUrl: string;
}

const SUBJECT_MAX_LENGTH = 120;

type Copy = {
  subject: (agent: string, location: string) => string;
  intro: (agent: string) => string;
  customer: string;
  noName: string;
  channel: string;
  channels: Record<string, string>;
  location: string;
  wholeOrganization: string;
  when: string;
  action: string;
  footer: (brand: string) => string;
};

const COPY: Record<EmailLocale, Copy> = {
  es: {
    subject: (agent, location) => `${agent} ha pasado una conversación al equipo (${location})`,
    intro: (agent) => `${agent} ha dejado de contestar en una conversación y la ha pasado al equipo.`,
    customer: "Cliente",
    noName: "Sin nombre",
    channel: "Canal",
    channels: { whatsapp: "WhatsApp", instagram: "Instagram", email: "Email", webchat: "Chat web", voice: "Teléfono", test: "Chat de pruebas" },
    location: "Local",
    wholeOrganization: "Toda la organización",
    when: "Desde",
    action: "Abrir la conversación",
    footer: (brand) => `Recibes este aviso porque puedes llevar las conversaciones de este local en ${brand}.`,
  },
  en: {
    subject: (agent, location) => `${agent} handed a conversation to the team (${location})`,
    intro: (agent) => `${agent} stopped replying in a conversation and handed it to the team.`,
    customer: "Customer",
    noName: "No name",
    channel: "Channel",
    channels: { whatsapp: "WhatsApp", instagram: "Instagram", email: "Email", webchat: "Web chat", voice: "Phone", test: "Test chat" },
    location: "Location",
    wholeOrganization: "Whole organization",
    when: "Since",
    action: "Open the conversation",
    footer: (brand) => `You get this notice because you can handle conversations for this location in ${brand}.`,
  },
};

export function renderHandoffEmail(input: HandoffEmailInput): RenderedEmail {
  const url = appUrl(input.conversationUrl);
  const copy = COPY[input.locale];
  const agent = oneLine(input.agentName);
  const customer = input.customerName?.trim() ? oneLine(input.customerName) : copy.noName;
  const channel = input.channel && Object.hasOwn(copy.channels, input.channel) ? copy.channels[input.channel] : null;
  const location = input.locationName ? oneLine(input.locationName) : copy.wholeOrganization;
  const when = formatLocalDateTime(input.handedOffAt, input.locale, input.timeZone);
  const brand = BRAND_NAME;

  const details: [string, string][] = [[copy.customer, customer]];
  if (channel) details.push([copy.channel, channel]);
  details.push([copy.location, location], [copy.when, when]);

  const subject = truncate(copy.subject(agent, location), SUBJECT_MAX_LENGTH);
  const text = [
    copy.intro(agent),
    "",
    ...details.map(([label, value]) => `${label}: ${value}`),
    "",
    `${copy.action} (${brand}): ${url}`,
    "",
    copy.footer(brand),
  ].join("\n");

  const rows = details
    .map(([label, value]) => `<p style="margin:0 0 4px;color:#4b5563">${escapeHtml(label)}: ${escapeHtml(value)}</p>`)
    .join("\n");
  const html = `<!doctype html>
<html lang="${input.locale}">
<body style="margin:0;padding:24px;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#111827;background:#ffffff">
<p style="margin:0 0 16px">${escapeHtml(copy.intro(agent))}</p>
${rows}
<p style="margin:20px 0 24px"><a href="${escapeHtml(url)}" style="display:inline-block;padding:10px 16px;border-radius:6px;background:#111827;color:#ffffff;text-decoration:none">${escapeHtml(copy.action)}</a></p>
<p style="margin:0;font-size:12px;color:#6b7280">${escapeHtml(copy.footer(brand))}</p>
</body>
</html>`;

  return { subject, html, text };
}
