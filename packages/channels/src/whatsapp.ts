import { z } from "zod";
import { ChannelSendError } from "./adapter.js";
import type { ChannelAdapter, ChannelCapabilities, ParsedWebhook, RawWebhook, SendResult, VerifiedSender } from "./adapter.js";
import type { DeliveryUpdate } from "./delivery.js";
import { deliveryUpdateSchema } from "./delivery.js";
import type { Attachment, NormalizedInbound, NormalizedOutbound } from "./message.js";
import { normalizedInboundSchema } from "./message.js";
import { metaHandshake, verifyMetaSignature } from "./signature.js";

// El adaptador de WhatsApp por la Cloud API de Meta, directa (ADR 0020), con
// el contrato de la capa de canales (ADR 0052 §1).
//
// - Entrada: Meta firma cada webhook con el secreto de la app
//   (X-Hub-Signature-256, HMAC-SHA256 del cuerpo crudo); la firma cubre a toda
//   la plataforma, así que cada mensaje se atribuye por su propia cuenta: el
//   phone_number_id del número que lo recibió (channel_accounts.external_id),
//   nunca otro campo del payload.
// - Idempotencia: la clave de cada mensaje que entra es su id en Meta (wamid),
//   como evento y como mensaje; los avisos de estado llevan el wamid del
//   mensaje que sale, y el estado solo avanza (nextDeliveryStatus).
// - Salida: texto (con botones de respuesta rápida) o plantilla por la Graph
//   API. Meta no acepta claves de idempotencia: quien envía guarda el wamid que
//   devuelve y no repite un envío que ya lo tiene, ni uno con
//   ChannelSendError.outcomeUnknown (corte, timeout, 5xx) sin conciliarlo antes.
//
// Los secretos (secreto de la app, token de verificación, token de acceso)
// llegan del worker por variables de entorno y nunca se registran.

export const WHATSAPP_SIGNATURE_HEADER = "x-hub-signature-256";
export const WHATSAPP_GRAPH_BASE_URL = "https://graph.facebook.com";

/** Lo que admite WhatsApp (Cloud API): 4096 caracteres, 3 botones de respuesta, plantillas y la ventana de 24 h. */
export const WHATSAPP_CAPABILITIES: ChannelCapabilities = {
  maxTextLength: 4096,
  maxButtons: 3,
  templates: true,
  serviceWindowHours: 24,
  deliveryReceipts: true,
};

export interface WhatsAppAdapterOptions {
  /** El secreto de la app de Meta: firma los webhooks. */
  appSecret: string;
  /** El token que se dio a Meta al dar de alta el webhook (el GET con hub.verify_token). */
  verifyToken: string;
  /** El token de acceso del sistema para la Graph API (envíos). */
  accessToken: string;
  /** La versión de la Graph API («v23.0»); sale de @repo/config. */
  graphApiVersion: string;
  /** Para los tests; por defecto, el fetch global. */
  fetch?: typeof fetch;
  /** Para los tests; por defecto, https://graph.facebook.com. */
  graphBaseUrl?: string;
  /** Cuánto espera un envío a la Graph API antes de darlo por perdido; por defecto, 15 s. */
  timeoutMs?: number;
}

const DEFAULT_SEND_TIMEOUT_MS = 15_000;

// El payload de Meta, solo lo que se lee. Todo opcional y sin rechazar campos
// nuevos: lo que no se entiende se ignora (ADR 0052 §1).
const mediaSchema = z.object({ id: z.string(), mime_type: z.string().optional(), caption: z.string().optional() });
const metaMessageSchema = z.object({
  from: z.string(),
  id: z.string(),
  timestamp: z.string(),
  type: z.string(),
  text: z.object({ body: z.string() }).optional(),
  image: mediaSchema.optional(),
  audio: mediaSchema.optional(),
  video: mediaSchema.optional(),
  document: mediaSchema.extend({ filename: z.string().optional() }).optional(),
  sticker: mediaSchema.optional(),
  location: z
    .object({ latitude: z.number(), longitude: z.number(), name: z.string().optional(), address: z.string().optional() })
    .optional(),
  button: z.object({ text: z.string() }).optional(),
  interactive: z
    .object({
      button_reply: z.object({ id: z.string(), title: z.string() }).optional(),
      list_reply: z.object({ id: z.string(), title: z.string() }).optional(),
    })
    .optional(),
  context: z.object({ id: z.string().optional() }).optional(),
});
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const metaStatusSchema = z.object({
  id: z.string(),
  status: z.string(),
  timestamp: z.string(),
  errors: z.array(z.object({ code: z.union([z.number(), z.string()]) })).optional(),
  biz_opaque_callback_data: z.string().optional(),
});
const metaChangeSchema = z.object({
  field: z.string(),
  value: z
    .object({
      metadata: z.object({ phone_number_id: z.string() }).optional(),
      contacts: z.array(z.object({ wa_id: z.string(), profile: z.object({ name: z.string() }).optional() })).optional(),
      messages: z.array(z.unknown()).optional(),
      statuses: z.array(z.unknown()).optional(),
    })
    .optional(),
});
const metaWebhookSchema = z.object({
  object: z.string(),
  entry: z.array(z.object({ changes: z.array(z.unknown()).optional() })).optional(),
});

const ACCOUNT_ID = /^\d{1,32}$/;
// El número del cliente sin el «+», como lo da Meta: E.164, como contact_identities.
const WA_ID = /^[1-9]\d{6,14}$/;

/** El instante de Meta (segundos Unix, en texto) en ISO; null si no es un número. */
function isoFromUnixSeconds(value: string): string | null {
  if (!/^\d{1,12}$/.test(value)) return null;
  return new Date(Number(value) * 1000).toISOString();
}

/** El contenido de un mensaje de Meta, como texto y adjuntos; null para los tipos que no se atienden (reacciones, sistema…). */
function content(message: z.infer<typeof metaMessageSchema>): { text: string; attachments: Attachment[] } | null {
  const media = (kind: Attachment["kind"], item: z.infer<typeof mediaSchema> | undefined) =>
    item
      ? {
          text: "",
          attachments: [
            {
              kind,
              providerRef: item.id,
              ...(item.mime_type ? { mimeType: item.mime_type } : {}),
              ...(item.caption ? { caption: item.caption } : {}),
            },
          ],
        }
      : null;
  switch (message.type) {
    case "text":
      return message.text ? { text: message.text.body, attachments: [] } : null;
    case "image":
      return media("image", message.image);
    case "sticker":
      return media("image", message.sticker);
    case "audio":
      return media("audio", message.audio);
    case "video":
      return media("video", message.video);
    case "document":
      return media("document", message.document);
    case "location": {
      const location = message.location;
      if (!location) return null;
      const caption = [location.name, location.address].filter(Boolean).join(", ");
      return {
        text: "",
        attachments: [{ kind: "location", providerRef: `${location.latitude},${location.longitude}`, ...(caption ? { caption } : {}) }],
      };
    }
    case "button":
      return message.button ? { text: message.button.text, attachments: [] } : null;
    case "interactive": {
      const reply = message.interactive?.button_reply ?? message.interactive?.list_reply;
      return reply ? { text: reply.title, attachments: [] } : null;
    }
    default:
      return null;
  }
}

function parseMessage(raw: unknown, account: string, names: ReadonlyMap<string, string>): NormalizedInbound | null {
  const message = metaMessageSchema.safeParse(raw);
  if (!message.success || !WA_ID.test(message.data.from)) return null;
  const body = content(message.data);
  const receivedAt = isoFromUnixSeconds(message.data.timestamp);
  if (!body || !receivedAt) return null;
  const name = names.get(message.data.from);
  const normalized = normalizedInboundSchema.safeParse({
    channel: "whatsapp",
    accountExternalId: account,
    providerEventId: message.data.id,
    providerMessageId: message.data.id,
    from: { kind: "phone", value: `+${message.data.from}` },
    ...(name ? { displayName: name.slice(0, 200) } : {}),
    receivedAt,
    text: body.text,
    attachments: body.attachments,
    ...(message.data.context?.id ? { replyToProviderMessageId: message.data.context.id } : {}),
  });
  return normalized.success ? normalized.data : null;
}

function parseStatus(raw: unknown, account: string): DeliveryUpdate | null {
  const status = metaStatusSchema.safeParse(raw);
  if (!status.success) return null;
  const at = isoFromUnixSeconds(status.data.timestamp);
  if (!at) return null;
  const code = status.data.errors?.[0]?.code;
  const update = deliveryUpdateSchema.safeParse({
    channel: "whatsapp",
    accountExternalId: account,
    providerMessageId: status.data.id,
    status: status.data.status,
    at,
    ...(status.data.status === "failed" && code !== undefined ? { errorCode: `whatsapp:${String(code)}` } : {}),
    // Lo que mandamos en biz_opaque_callback_data: solo si es un id nuestro.
    ...(status.data.biz_opaque_callback_data !== undefined && UUID.test(status.data.biz_opaque_callback_data)
      ? { reference: status.data.biz_opaque_callback_data.toLowerCase() }
      : {}),
  });
  return update.success ? update.data : null;
}

/** Traduce un webhook de Meta ya verificado: mensajes nuevos y avisos de estado. Lo que no entiende lo ignora. */
export function parseWhatsAppWebhook(rawBody: string): ParsedWebhook {
  const result: ParsedWebhook = { messages: [], statuses: [] };
  const webhook = metaWebhookSchema.safeParse(JSON.parse(rawBody));
  if (!webhook.success || webhook.data.object !== "whatsapp_business_account") return result;
  for (const entry of webhook.data.entry ?? []) {
    for (const rawChange of entry.changes ?? []) {
      const change = metaChangeSchema.safeParse(rawChange);
      if (!change.success || change.data.field !== "messages" || !change.data.value) continue;
      const value = change.data.value;
      const account = value.metadata?.phone_number_id;
      // Sin la cuenta que lo recibió no hay a quién atribuirlo: se ignora.
      if (!account || !ACCOUNT_ID.test(account)) continue;
      const names = new Map((value.contacts ?? []).flatMap((contact) => (contact.profile ? [[contact.wa_id, contact.profile.name] as const] : [])));
      for (const raw of value.messages ?? []) {
        const message = parseMessage(raw, account, names);
        if (message) result.messages.push(message);
      }
      for (const raw of value.statuses ?? []) {
        const status = parseStatus(raw, account);
        if (status) result.statuses.push(status);
      }
    }
  }
  return result;
}

/** El cuerpo del envío a la Graph API (sin el destino validado ni la cuenta, que van aparte). */
export function whatsAppSendBody(message: NormalizedOutbound, to: string): Record<string, unknown> {
  const base = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    // Meta lo devuelve en los avisos de estado: concilia un aviso que llega
    // antes de guardar el wamid, o el de un envío con resultado desconocido.
    ...(message.reference ? { biz_opaque_callback_data: message.reference } : {}),
  };
  if (message.template) {
    const { name, language, variables } = message.template;
    return {
      ...base,
      type: "template",
      template: {
        name,
        language: { code: language },
        ...(variables.length > 0 ? { components: [{ type: "body", parameters: variables.map((text) => ({ type: "text", text })) }] } : {}),
      },
    };
  }
  const text = message.text ?? "";
  if (message.buttons.length > 0) {
    return {
      ...base,
      type: "interactive",
      interactive: {
        type: "button",
        body: { text },
        action: { buttons: message.buttons.map((button) => ({ type: "reply", reply: { id: button.id, title: button.title } })) },
      },
    };
  }
  return { ...base, type: "text", text: { body: text, preview_url: false } };
}

// Los códigos de Meta que se arreglan reintentando: límites de ritmo (4, 80007,
// 130429, 131056), error temporal (2, 131000) y servicio no disponible (1).
const RETRYABLE_META_CODES = new Set([1, 2, 4, 80007, 130429, 131000, 131056]);

const metaErrorSchema = z.object({ error: z.object({ code: z.number().optional() }).optional() });
const metaSendResponseSchema = z.object({ messages: z.array(z.object({ id: z.string().min(1).max(200) })).min(1) });

export function createWhatsAppAdapter(options: WhatsAppAdapterOptions): ChannelAdapter {
  const doFetch = options.fetch ?? fetch;
  const base = (options.graphBaseUrl ?? WHATSAPP_GRAPH_BASE_URL).replace(/\/+$/, "");
  if (!/^v\d{1,3}\.\d{1,3}$/.test(options.graphApiVersion)) {
    throw new Error("graphApiVersion: vNN.N (p. ej. v23.0)");
  }
  // Un timeout que no vale haría fallar AbortSignal.timeout dentro del envío, y
  // ese fallo parecería un corte de red con resultado desconocido sin que
  // hubiera salido nada: se rechaza al crear el adaptador.
  const timeoutMs = options.timeoutMs ?? DEFAULT_SEND_TIMEOUT_MS;
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
    throw new Error("timeoutMs: un entero positivo de milisegundos");
  }
  return {
    channel: "whatsapp",
    capabilities: WHATSAPP_CAPABILITIES,
    verify(webhook: RawWebhook): Promise<VerifiedSender | null> {
      const ok = verifyMetaSignature(options.appSecret, webhook.rawBody, webhook.headers[WHATSAPP_SIGNATURE_HEADER]);
      return Promise.resolve(ok ? { scope: "platform" } : null);
    },
    handshake(query: URLSearchParams): string | null {
      return metaHandshake(options.verifyToken, query);
    },
    parse(webhook: RawWebhook): ParsedWebhook {
      return parseWhatsAppWebhook(webhook.rawBody);
    },
    async send(message: NormalizedOutbound): Promise<SendResult> {
      if (message.channel !== "whatsapp") throw new ChannelSendError("mensaje de otro canal", false, "wrong_channel");
      if (!ACCOUNT_ID.test(message.accountExternalId)) throw new ChannelSendError("cuenta de WhatsApp no válida", false, "invalid_account");
      const to = message.to.kind === "phone" ? message.to.value.replace(/^\+/, "") : "";
      if (!WA_ID.test(to)) throw new ChannelSendError("destino de WhatsApp no válido", false, "invalid_recipient");
      if (message.attachments.length > 0) throw new ChannelSendError("los adjuntos que salen aún no se envían", false, "attachments_unsupported");
      // Ni texto ni plantilla (o un cuerpo en blanco): Meta lo rechazaría; mejor no llamar.
      if (!message.template && !message.text?.trim()) throw new ChannelSendError("mensaje sin texto ni plantilla", false, "empty_message");
      const url = `${base}/${options.graphApiVersion}/${message.accountExternalId}/messages`;
      let response: Response;
      try {
        response = await doFetch(url, {
          method: "POST",
          headers: { authorization: `Bearer ${options.accessToken}`, "content-type": "application/json" },
          body: JSON.stringify(whatsAppSendBody(message, to)),
          // Una conexión colgada no bloquea el envío para siempre.
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (error) {
        // La red o el timeout: se puede reintentar, pero Meta pudo recibirlo (sin clave de
        // idempotencia, un reintento a ciegas lo duplicaría). Sin el mensaje del error: puede llevar la URL.
        const code = (error as Error | undefined)?.name === "TimeoutError" ? "timeout" : "network";
        throw new ChannelSendError("no se pudo hablar con la Graph API", true, code, { cause: error, outcomeUnknown: true });
      }
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const code = metaErrorSchema.safeParse(payload).data?.error?.code;
        const retryable = response.status === 429 || response.status >= 500 || (code !== undefined && RETRYABLE_META_CODES.has(code));
        // Un 5xx no dice si Meta llegó a aceptarlo; un 4xx (429 incluido) es un rechazo: no salió.
        const outcomeUnknown = response.status >= 500;
        // Solo el código: el texto del error de Meta puede llevar datos del cliente.
        throw new ChannelSendError(`la Graph API rechazó el envío (HTTP ${response.status})`, retryable, code === undefined ? `http_${response.status}` : `whatsapp:${code}`, {
          outcomeUnknown,
        });
      }
      const id = metaSendResponseSchema.safeParse(payload).data?.messages[0]?.id;
      // Un 2xx sin id: Meta lo aceptó, pero no hay con qué seguirlo. No se repite.
      if (!id) throw new ChannelSendError("respuesta de la Graph API sin id de mensaje", false, "bad_response", { outcomeUnknown: true });
      return { providerMessageId: id };
    },
  };
}
