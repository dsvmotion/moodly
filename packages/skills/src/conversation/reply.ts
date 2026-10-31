import { REPLY_SKILL_KEY, defineSkill } from "@repo/agent-core";
import type { SkillDefinition } from "@repo/agent-core";
import { z } from "zod";

// La respuesta del agente a la persona con la que habla (paso 4d-2): la skill
// reply con la que el turno (runAgentTurn) entrega su texto final.
//
// - Va siempre a la conversación del run: el destino lo pone el runtime
//   (ctx.target), nunca el modelo, que ni siquiera la ve como herramienta.
// - external_message: nace en draft. La escribe el agente y la envía una
//   persona hasta que el negocio suba la autonomía de su agente.
// - Idempotente con la idempotency_key de la ejecución: un reintento no manda
//   el mensaje dos veces (lo garantiza quien envía).

/** Quien entrega el mensaje: el chat web lo guarda en la conversación; WhatsApp, además, lo manda. */
export interface ConversationSender {
  /** Con la misma idempotencyKey, un solo mensaje: devuelve el que ya existe. */
  send(input: { conversationId: string; text: string; idempotencyKey: string }): Promise<{ messageId: string }>;
}

export class ReplyTargetError extends Error {
  override name = "ReplyTargetError";
}

/** Por debajo del límite de WhatsApp (4.096) para que quepa en cualquier canal. */
export const MAX_REPLY_LENGTH = 4000;

export type ReplySkill = SkillDefinition<{ text: string }, { message_id: string }>;

export function createReplySkill({ sender }: { sender: ConversationSender }): ReplySkill {
  return defineSkill({
    key: REPLY_SKILL_KEY,
    version: 1,
    description: "Responde a la persona con la que hablas, en esta conversación.",
    effectClass: "external_message",
    defaultAutonomy: "draft",
    input: z.object({ text: z.string().trim().min(1).max(MAX_REPLY_LENGTH) }),
    output: z.object({ message_id: z.string() }),
    preview: (_ctx, input) => Promise.resolve({ summary: `Responder: «${input.text}»` }),
    async execute(ctx, input) {
      if (ctx.target.kind !== "conversation") throw new ReplyTargetError("la respuesta solo va a la conversación del run");
      const { messageId } = await sender.send({
        conversationId: ctx.target.conversationId,
        text: input.text,
        idempotencyKey: ctx.idempotencyKey,
      });
      return { message_id: messageId };
    },
  });
}
