import type { TenantDb } from "@repo/db/service";
import type { ConversationSender } from "@repo/skills";

// La respuesta del agente en el chat web (paso 4d-2): se guarda en la
// conversación y el widget la lee de ahí. WhatsApp, además, la mandará por su
// API (B19), detrás de la misma interfaz.
//
// Idempotente con la clave de la ejecución (messages.idempotency_key): si un
// reintento llega después de escribir, devuelve el mensaje que ya existe. No
// hay carrera: DBOS ejecuta cada workflow en un solo proceso a la vez.
export function createConversationSender(db: TenantDb): ConversationSender {
  return {
    async send({ conversationId, text, idempotencyKey }) {
      const existing = await db.from("messages").select("id").eq("idempotency_key", idempotencyKey).limit(1).maybeSingle();
      if (existing.error) throw new Error(`no se pudo comprobar la respuesta (${existing.error.code})`);
      if (existing.data) return { messageId: existing.data.id };
      const inserted = await db
        .from("messages")
        .insert({
          conversation_id: conversationId,
          direction: "out",
          author: "agent",
          content: text,
          status: "sent",
          idempotency_key: idempotencyKey,
        })
        .select("id")
        .single();
      if (inserted.error) throw new Error(`no se pudo guardar la respuesta (${inserted.error.code})`);
      return { messageId: inserted.data.id };
    },
  };
}
