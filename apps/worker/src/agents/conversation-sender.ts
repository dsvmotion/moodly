import type { TenantDb } from "@repo/db/service";
import type { ConversationSender } from "@repo/skills";

// La respuesta del agente (paso 4d-2): se guarda en la conversación. En el chat
// web (y el de pruebas) el widget la lee de ahí, así que nace «sent». Por un
// canal que envía el worker (WhatsApp, O-01) nace «pending»: la base de datos
// emite message.outbound en la misma transacción y channels.send la envía
// (apps/worker/src/channels/send.ts).
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

/** Los canales cuyo mensaje envía el worker (los de private.emit_message_outbound, 20261113120000). */
export const WORKER_SENT_CHANNELS: ReadonlySet<string> = new Set(["whatsapp"]);

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
          const [conversation] = await sql.query<{ channel: string }>(
            "select channel from public.conversations where organization_id = $1 and id = $2",
            [db.organizationId, conversationId],
          );
          const status = conversation && WORKER_SENT_CHANNELS.has(conversation.channel) ? "pending" : "sent";
          const [inserted] = await sql.query<{ id: string }>(
            `insert into public.messages (organization_id, conversation_id, direction, author, content, status, idempotency_key)
             values ($1, $2, 'out', 'agent', $3, $5, $4)
             returning id`,
            [db.organizationId, conversationId, text, idempotencyKey, status],
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
