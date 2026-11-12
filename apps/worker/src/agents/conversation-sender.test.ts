import type { TenantDb } from "@repo/db/service";
import { describe, expect, it } from "vitest";
import { ConversationNotAgentModeError, NOT_AGENT_MODE_CODE, createConversationSender, isNotAgentMode } from "./conversation-sender.ts";

// El envío del mensaje del agente (R-02): si la base de datos lo rechaza porque
// la conversación ya no la lleva el agente, no se guarda y se dice por qué.

/** Una base de datos de mentira: la búsqueda por clave no encuentra nada y el insert contesta lo que se le diga. */
function fakeDb(insertResult: { data: { id: string } | null; error: { code: string } | null }) {
  const inserted: unknown[] = [];
  const chain = {
    select: () => chain,
    eq: () => chain,
    limit: () => chain,
    maybeSingle: () => Promise.resolve({ data: null, error: null }),
  };
  const db = {
    from: () => ({
      ...chain,
      insert: (row: unknown) => {
        inserted.push(row);
        return { select: () => ({ single: () => Promise.resolve(insertResult) }) };
      },
    }),
  } as unknown as TenantDb;
  return { db, inserted };
}

describe("createConversationSender", () => {
  it("con la conversación en manos del agente, guarda el mensaje como del agente", async () => {
    const { db, inserted } = fakeDb({ data: { id: "m-1" }, error: null });
    await expect(createConversationSender(db).send({ conversationId: "c-1", text: "Hola", idempotencyKey: "k-1" })).resolves.toEqual({
      messageId: "m-1",
    });
    expect(inserted).toEqual([expect.objectContaining({ conversation_id: "c-1", author: "agent", direction: "out", idempotency_key: "k-1" })]);
  });

  it("si la base de datos lo rechaza porque la lleva una persona, lanza ConversationNotAgentModeError", async () => {
    const { db } = fakeDb({ data: null, error: { code: NOT_AGENT_MODE_CODE } });
    const sent = createConversationSender(db).send({ conversationId: "c-1", text: "Hola", idempotencyKey: "k-2" });
    await expect(sent).rejects.toBeInstanceOf(ConversationNotAgentModeError);
  });

  it("cualquier otro error sigue siendo un error de guardado", async () => {
    const { db } = fakeDb({ data: null, error: { code: "23505" } });
    const sent = createConversationSender(db).send({ conversationId: "c-1", text: "Hola", idempotencyKey: "k-3" });
    await expect(sent).rejects.toThrow("no se pudo guardar la respuesta (23505)");
    await expect(sent).rejects.not.toBeInstanceOf(ConversationNotAgentModeError);
  });

  it("isNotAgentMode lo reconoce también por su nombre (después de pasar por un paso de DBOS)", () => {
    expect(isNotAgentMode(new ConversationNotAgentModeError("x"))).toBe(true);
    expect(isNotAgentMode(Object.assign(new Error("x"), { name: "ConversationNotAgentModeError" }))).toBe(true);
    expect(isNotAgentMode(new Error("x"))).toBe(false);
    expect(isNotAgentMode(null)).toBe(false);
  });
});
