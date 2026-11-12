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
    // Como moodly_worker, bajo RLS (PL-T1 3c-2, 20261112140000): solo mensajes
    // del agente (guard_worker_message) y solo en su organización.
    async send({ conversationId, text, idempotencyKey }) {
      try {
        return await db.transaction(async (sql) => {
          const [existing] = await sql.query<{ id: string }>("select id from public.messages where idempotency_key = $1 limit 1", [
            idempotencyKey,
          ]);
          if (existing) return { messageId: existing.id };
          const [inserted] = await sql.query<{ id: string }>(
            `insert into public.messages (organization_id, conversation_id, direction, author, content, status, idempotency_key)
             values ($1, $2, 'out', 'agent', $3, 'sent', $4)
             returning id`,
            [db.organizationId, conversationId, text, idempotencyKey],
          );
          if (!inserted) throw new Error("no se pudo guardar la respuesta");
          return { messageId: inserted.id };
        });
      } catch (error) {
        const code = (error as { code?: unknown } | null)?.code;
        if (code === NOT_AGENT_MODE_CODE) {
          throw new ConversationNotAgentModeError("la conversación no la lleva el agente: el mensaje no se guarda");
        }
        // Solo el código: el mensaje de Postgres puede llevar datos.
        if (typeof code === "string") throw new Error(`no se pudo guardar la respuesta (${code})`, { cause: error });
        throw error;
      }
    },
  };
}
