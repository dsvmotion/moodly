import { defineSkill } from "@repo/agent-core";
import type { SkillDefinition } from "@repo/agent-core";
import { z } from "zod";

// Preguntar al equipo en vez de inventar (paso B20-4b, MANUAL §5.9 «No
// improvisar»). Cuando search_knowledge no trae lo que pregunta el cliente, el
// agente deja la pregunta al equipo (knowledge_requests) y le dice al cliente
// que una persona le contestará por esta misma conversación. Cuando alguien del
// equipo contesta, la base de datos manda la respuesta al cliente y la guarda
// como conocimiento (B20-4a): la próxima vez el agente ya lo sabe.
//
// - La organización, el local, el run y la conversación los pone el runtime; el
//   modelo solo escribe la pregunta.
// - Escritura interna con autonomía execute de serie: preguntar al equipo no
//   compromete nada ni sale hacia el cliente.
// - Una por ejecución (idempotency_key): si el paso se repite, devuelve la misma.

export const ASK_TEAM_SKILL_KEY = "ask_team";

/** La pregunta, como la verá el equipo (la base de datos admite lo mismo). */
export const MAX_QUESTION = 500;

export interface KnowledgeRequestDraft {
  locationId: string | null;
  conversationId: string;
  runId: string;
  question: string;
  idempotencyKey: string;
}

export interface KnowledgeRequestStore {
  /** Idempotente con la clave: si ya existe, devuelve esa. */
  create(draft: KnowledgeRequestDraft): Promise<{ id: string; alreadyAsked: boolean }>;
}

export class AskTeamScopeError extends Error {
  override name = "AskTeamScopeError";
}

const ASKED_NOTE =
  "The team has been asked. Tell the customer that a person from the team will reply here, without guessing the answer.";

export type AskTeamSkill = SkillDefinition<{ question: string }, { request_id: string; already_asked: boolean; note: string }>;

export function createAskTeamSkill({ store }: { store: KnowledgeRequestStore }): AskTeamSkill {
  return defineSkill({
    key: ASK_TEAM_SKILL_KEY,
    version: 1,
    description:
      "Asks the business team a question you cannot answer with search_knowledge (for example a price, a policy or a service you found nothing about). Write the question as the team should read it, without personal data. A person will reply to the customer in this conversation.",
    effectClass: "internal_write",
    defaultAutonomy: "execute",
    input: z.object({ question: z.string().trim().min(5).max(MAX_QUESTION) }),
    output: z.object({ request_id: z.string(), already_asked: z.boolean(), note: z.string() }),
    preview: (_ctx, input) => Promise.resolve({ summary: `Preguntar al equipo: «${input.question}»` }),
    async execute(ctx, input) {
      // Solo dentro de una conversación: la respuesta del equipo va al cliente por ella.
      if (!ctx.conversationId) throw new AskTeamScopeError("este run no tiene conversación: no hay a quién contestar");
      const { id, alreadyAsked } = await store.create({
        locationId: ctx.locationId,
        conversationId: ctx.conversationId,
        runId: ctx.runId,
        question: input.question,
        idempotencyKey: ctx.idempotencyKey,
      });
      return { request_id: id, already_asked: alreadyAsked, note: ASKED_NOTE };
    },
  });
}
