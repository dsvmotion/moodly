import { ChannelSendError } from "./adapter.js";
import type { ChannelAdapter, ChannelCapabilities, ParsedWebhook, RawWebhook, SendResult, VerifiedSender } from "./adapter.js";
import type { Channel, NormalizedOutbound } from "./message.js";
import { normalizedInboundSchema } from "./message.js";
import { hmacSha256Hex, verifyHmacSha256 } from "./signature.js";

// Un adaptador de prueba: firma HMAC-SHA256 en una cabecera (como los de
// verdad, en tiempo constante), cuerpo JSON ya normalizado. Con scope
// "platform" firma el cuerpo, como Meta; con "account", la cuenta y el cuerpo,
// con la cuenta en otra cabecera, como el token del chat web, y envíos que se apuntan en memoria. Para los
// tests de la capa (duplicados, estados, toma de control) sin proveedor real.

export const FAKE_SIGNATURE_HEADER = "x-fake-signature";
export const FAKE_ACCOUNT_HEADER = "x-fake-account";

export interface FakeAdapter extends ChannelAdapter {
  readonly sent: NormalizedOutbound[];
  /** El próximo envío falla (una vez) con este error. */
  failNextSend(error: ChannelSendError): void;
}

export function createFakeAdapter(options: {
  channel?: Channel;
  secret: string;
  scope?: "platform" | "account";
  capabilities?: Partial<ChannelCapabilities>;
}): FakeAdapter {
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
    verify(webhook: RawWebhook): Promise<VerifiedSender | null> {
      const signature = webhook.headers[FAKE_SIGNATURE_HEADER];
      if (options.scope === "account") {
        const account = webhook.headers[FAKE_ACCOUNT_HEADER];
        if (!account || !verifyHmacSha256(options.secret, `${account}.${webhook.rawBody}`, signature)) return Promise.resolve(null);
        return Promise.resolve({ scope: "account", accountExternalId: account });
      }
      return Promise.resolve(verifyHmacSha256(options.secret, webhook.rawBody, signature) ? { scope: "platform" } : null);
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

/** Las cabeceras de firma que espera el adaptador de prueba: del cuerpo, o de una cuenta y el cuerpo. */
export function fakeSignature(secret: string, rawBody: string, account?: string): Record<string, string> {
  if (account === undefined) return { [FAKE_SIGNATURE_HEADER]: hmacSha256Hex(secret, rawBody) };
  return { [FAKE_SIGNATURE_HEADER]: hmacSha256Hex(secret, `${account}.${rawBody}`), [FAKE_ACCOUNT_HEADER]: account };
}

export { ChannelSendError };
