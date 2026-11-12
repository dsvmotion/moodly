import type { TenantDb } from "@repo/db/service";
import type { ConversationSender } from "@repo/skills";

// La respuesta del agente en el chat web (paso 4d-2): se guarda en la
// conversación y el widget la lee de ahí. WhatsApp, además, la mandará por su
// API (B19), detrás de la misma interfaz.
//
// Idempotente con la clave de la ejecución (messages.idempotency_key): si un
// reintento llega después de escribir, devuelve el mensaje que ya existe. No
// hay carrera: DBOS ejecuta cada workflow en un solo proceso a la vez.
//
// Solo en una conversación que lleva el agente (R-02): lo comprueba la base de
// datos en el mismo insert (guard_agent_message_mode, con la conversación
// bloqueada FOR SHARE), así que tomar el control mientras el agente piensa, o
// antes de que salga un borrador aprobado o un recordatorio, gana siempre. Si la
// conversación ya no es del agente, no se guarda nada y se lanza
// ConversationNotAgentModeError.

/** El código con el que la base de datos rechaza un mensaje del agente en una conversación que no lleva él. */
export const NOT_AGENT_MODE_CODE = "55000";

/** El mensaje del agente no se guardó: la conversación la lleva una persona (o está cerrada). */
export class ConversationNotAgentModeError extends Error {
  override name = "ConversationNotAgentModeError";
}

/** Si un error es el de una conversación que ya no lleva el agente (también después de pasar por un paso de DBOS). */
export function isNotAgentMode(error: unknown): boolean {
  return error instanceof ConversationNotAgentModeError || (error as { name?: unknown } | null)?.name === "ConversationNotAgentModeError";
}

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
      if (inserted.error?.code === NOT_AGENT_MODE_CODE) {
        throw new ConversationNotAgentModeError("la conversación no la lleva el agente: el mensaje no se guarda");
      }
      if (inserted.error) throw new Error(`no se pudo guardar la respuesta (${inserted.error.code})`);
      return { messageId: inserted.data.id };
    },
  };
}
