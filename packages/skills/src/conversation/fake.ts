import type { ConversationSender } from "./reply.js";

// Envío falso para los tests y las evals: guarda los mensajes y respeta la
// idempotencia como el de verdad (la misma clave, el mismo mensaje).

export interface SentMessage {
  id: string;
  conversationId: string;
  text: string;
  idempotencyKey: string;
}

export interface FakeConversationSender extends ConversationSender {
  readonly sent: SentMessage[];
}

export function createFakeConversationSender(): FakeConversationSender {
  const sent: SentMessage[] = [];
  return {
    sent,
    send({ conversationId, text, idempotencyKey }) {
      const existing = sent.find((message) => message.idempotencyKey === idempotencyKey);
      if (existing) return Promise.resolve({ messageId: existing.id });
      const message = { id: `msg-${sent.length + 1}`, conversationId, text, idempotencyKey };
      sent.push(message);
      return Promise.resolve({ messageId: message.id });
    },
  };
}
