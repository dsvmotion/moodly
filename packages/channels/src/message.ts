import { z } from "zod";

// El mensaje normalizado (ADR 0052 §1, MANUAL §8): lo que entra y lo que sale
// por cualquier canal, con la misma forma. Cada adaptador traduce de y a su
// proveedor; el resto de la plataforma solo conoce esto.

/** Canales por los que habla un cliente (ADR 0052 §1 y §7). */
export const CUSTOMER_CHANNELS = ["whatsapp", "webchat", "email", "telegram", "instagram", "messenger", "voice", "sms"] as const;
/** Canales por los que el equipo recibe avisos y aprobaciones. */
export const TEAM_CHANNELS = ["slack", "discord", "teams"] as const;
export const CHANNELS = [...CUSTOMER_CHANNELS, ...TEAM_CHANNELS] as const;
export type CustomerChannel = (typeof CUSTOMER_CHANNELS)[number];
export type TeamChannel = (typeof TEAM_CHANNELS)[number];
export type Channel = (typeof CHANNELS)[number];

export function isCustomerChannel(channel: string): channel is CustomerChannel {
  return (CUSTOMER_CHANNELS as readonly string[]).includes(channel);
}

/** Quién escribe, como lo identifica el canal (contact_identities.kind). La organización nunca sale de aquí. */
export const contactAddressSchema = z.object({
  kind: z.enum(["phone", "email", "instagram", "webchat", "handle"]),
  value: z.string().trim().min(1).max(320),
});
export type ContactAddress = z.infer<typeof contactAddressSchema>;

export const attachmentSchema = z.object({
  kind: z.enum(["image", "audio", "video", "document", "location"]),
  /** Dónde lo guarda el proveedor (o un id suyo): se descarga aparte, nunca se sigue a ciegas. */
  providerRef: z.string().min(1).max(500),
  mimeType: z.string().max(100).optional(),
  caption: z.string().max(1024).optional(),
});
export type Attachment = z.infer<typeof attachmentSchema>;

/** Lo máximo que guarda messages.content. */
export const MAX_CONTENT_LENGTH = 10_000;

/**
 * Un mensaje que entra. accountExternalId identifica la cuenta del canal que
 * recibió el webhook (channel_accounts.external_id): de esa fila sale la
 * organización, nunca de otro campo del payload (ADR 0052 §2).
 */
export const normalizedInboundSchema = z.object({
  channel: z.enum(CHANNELS),
  accountExternalId: z.string().min(1).max(200),
  /** El id del evento del proveedor: con la cuenta, la clave única de inbound_events. */
  providerEventId: z.string().min(1).max(200),
  /** El id del mensaje en el proveedor (wamid…), si lo tiene. */
  providerMessageId: z.string().min(1).max(200).optional(),
  from: contactAddressSchema,
  /** El nombre que da el canal, si lo da (no se fía para nada más que mostrarlo). */
  displayName: z.string().max(200).optional(),
  receivedAt: z.iso.datetime({ offset: true }),
  text: z.string().max(MAX_CONTENT_LENGTH).default(""),
  attachments: z.array(attachmentSchema).max(10).default([]),
  /** El id del proveedor del mensaje al que contesta, si el canal lo dice. */
  replyToProviderMessageId: z.string().max(200).optional(),
}).refine((message) => message.text.trim().length > 0 || message.attachments.length > 0, {
  message: "un mensaje sin texto ni adjuntos no es un mensaje",
});
export type NormalizedInbound = z.infer<typeof normalizedInboundSchema>;

export const buttonSchema = z.object({ id: z.string().min(1).max(256), title: z.string().trim().min(1).max(20) });
export type Button = z.infer<typeof buttonSchema>;

/** Una plantilla ya elegida, con sus variables en orden ({{1}}, {{2}}…). */
export const templateRefSchema = z.object({
  name: z.string().min(1).max(512),
  language: z.string().min(2).max(15),
  variables: z.array(z.string().max(1024)).max(20).default([]),
});
export type TemplateRef = z.infer<typeof templateRefSchema>;

/**
 * Un mensaje que sale: texto libre o una plantilla, nunca los dos. El destino
 * lo pone la plataforma desde la conversación, nunca el modelo.
 */
export const normalizedOutboundSchema = z
  .object({
    channel: z.enum(CHANNELS),
    accountExternalId: z.string().min(1).max(200),
    to: contactAddressSchema,
    text: z.string().max(MAX_CONTENT_LENGTH).optional(),
    template: templateRefSchema.optional(),
    buttons: z.array(buttonSchema).max(10).default([]),
    attachments: z.array(attachmentSchema).max(10).default([]),
    /** La clave de idempotencia del envío (la de messages.idempotency_key): un reintento no envía dos veces. */
    idempotencyKey: z.string().min(1).max(200),
  })
  .refine((message) => (message.text !== undefined && message.text.trim().length > 0) !== (message.template !== undefined), {
    message: "un mensaje que sale lleva texto o una plantilla, no las dos cosas ni ninguna",
  });
export type NormalizedOutbound = z.infer<typeof normalizedOutboundSchema>;
