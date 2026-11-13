import { REQUEST_HUMAN_REASONS, REQUEST_HUMAN_SKILL_KEY, defineSkill } from "@repo/agent-core";
import type { RequestHumanReason, SkillDefinition } from "@repo/agent-core";
import { z } from "zod";

// Pasar la conversación a una persona (CU3): cuando el cliente pide hablar con
// una persona, o lo que pide no es del ámbito del agente.
//
// - El modelo solo elige el motivo, de una lista cerrada. A quién se pasa, en
//   qué conversación y de qué organización lo decide la plataforma: el run, la
//   fila de la conversación y handoff_notification (20261112200000). Nada de
//   destinatarios, textos ni ids en los argumentos.
// - La skill no escribe nada: el turno se acaba en manos de una persona
//   (runAgentTurn) y el worker pasa la conversación a 'human', como en el
//   resto de pasos; de ahí salen el aviso en la bandeja y el email al equipo.
// - internal_write y autónoma: no sale nada hacia nadie y no tiene sentido
//   pedir aprobación para pedir una persona.

export type RequestHumanSkill = SkillDefinition<{ reason: RequestHumanReason }, { reason: RequestHumanReason }>;

export function createRequestHumanSkill(): RequestHumanSkill {
  return defineSkill({
    key: REQUEST_HUMAN_SKILL_KEY,
    version: 1,
    description:
      "Hands the conversation to a person from the team. Use it when the customer asks to talk to a person (reason: customer_asked) or when what they ask is outside what you can do (reason: out_of_scope). Do not use it for questions you can answer.",
    effectClass: "internal_write",
    defaultAutonomy: "autonomous",
    input: z.object({ reason: z.enum(REQUEST_HUMAN_REASONS) }),
    output: z.object({ reason: z.enum(REQUEST_HUMAN_REASONS) }),
    preview: (_ctx, input) => Promise.resolve({ summary: input.reason === "customer_asked" ? "Pasar a una persona: lo pide el cliente" : "Pasar a una persona: fuera de su ámbito" }),
    execute: (_ctx, input) => Promise.resolve({ reason: input.reason }),
  });
}
