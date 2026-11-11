import { ChannelSendError } from "./adapter.js";
import type { ChannelAdapter, ChannelCapabilities, ParsedWebhook, RawWebhook, SendResult } from "./adapter.js";
import type { Channel, NormalizedOutbound } from "./message.js";
import { normalizedInboundSchema } from "./message.js";
import { hmacSha256Hex, verifyHmacSha256 } from "./signature.js";

// Un adaptador de prueba: firma HMAC-SHA256 del cuerpo en una cabecera (como
// los de verdad, en tiempo constante), cuerpo JSON ya normalizado, y envíos que se apuntan en memoria. Para los
// tests de la capa (duplicados, estados, toma de control) sin proveedor real.

export const FAKE_SIGNATURE_HEADER = "x-fake-signature";

export interface FakeAdapter extends ChannelAdapter {
  readonly sent: NormalizedOutbound[];
  /** El próximo envío falla (una vez) con este error. */
  failNextSend(error: ChannelSendError): void;
}

export function createFakeAdapter(options: { channel?: Channel; secret: string; capabilities?: Partial<ChannelCapabilities> }): FakeAdapter {
  const sent: NormalizedOutbound[] = [];
  const byKey = new Map<string, SendResult>();
  let nextError: ChannelSendError | null = null;
  return {
    channel: options.channel ?? "webchat",
    capabilities: {
      maxTextLength: 4096,
      maxButtons: 3,
      templates: false,
      serviceWindowHours: null,
      deliveryReceipts: true,
      ...options.capabilities,
    },
    sent,
    failNextSend(error) {
      nextError = error;
    },
    verify(webhook: RawWebhook) {
      return Promise.resolve(verifyHmacSha256(options.secret, webhook.rawBody, webhook.headers[FAKE_SIGNATURE_HEADER]));
    },
    parse(webhook: RawWebhook): ParsedWebhook {
      const body = JSON.parse(webhook.rawBody) as { messages?: unknown[]; statuses?: ParsedWebhook["statuses"] };
      return {
        messages: (body.messages ?? []).map((message) => normalizedInboundSchema.parse(message)),
        statuses: body.statuses ?? [],
      };
    },
    send(message: NormalizedOutbound) {
      if (nextError) {
        const error = nextError;
        nextError = null;
        return Promise.reject(error);
      }
      const existing = byKey.get(message.idempotencyKey);
      if (existing) return Promise.resolve(existing);
      sent.push(message);
      const result = { providerMessageId: `fake-${sent.length}` };
      byKey.set(message.idempotencyKey, result);
      return Promise.resolve(result);
    },
  };
}

/** La cabecera de firma que espera el adaptador de prueba para ese cuerpo. */
export function fakeSignature(secret: string, rawBody: string): Record<string, string> {
  return { [FAKE_SIGNATURE_HEADER]: hmacSha256Hex(secret, rawBody) };
}

export { ChannelSendError };
