import type { TenantDb } from "@repo/db/service";
import { describe, expect, it } from "vitest";
import { ConversationNotAgentModeError, NOT_AGENT_MODE_CODE, createConversationSender, isNotAgentMode } from "./conversation-sender.ts";

// El envío del mensaje del agente (R-02): si la base de datos lo rechaza porque
// la conversación ya no la lleva el agente, no se guarda y se dice por qué.

/**
 * Una base de datos de mentira con la transacción bajo RLS (PL-T1 3c-2): la
 * búsqueda por clave no encuentra nada y el insert contesta lo que se le diga
 * (la fila, o un error de Postgres con su código).
 */
function fakeDb(insertResult: { id: string } | { code: string }) {
  const inserted: { text: string; values: readonly unknown[] }[] = [];
  const query = async (text: string, values: readonly unknown[] = []) => {
    if (/^\s*select/.test(text)) return [];
    inserted.push({ text, values });
    if ("code" in insertResult) throw Object.assign(new Error("pg"), { code: insertResult.code });
    return [insertResult];
  };
  const db = {
    organizationId: "org-1",
    transaction: async <T>(fn: (sql: { query: typeof query }) => Promise<T>) => fn({ query }),
  } as unknown as TenantDb;
  return { db, inserted };
}

describe("createConversationSender", () => {
  it("con la conversación en manos del agente, guarda el mensaje como del agente", async () => {
    const { db, inserted } = fakeDb({ id: "m-1" });
    await expect(createConversationSender(db).send({ conversationId: "c-1", text: "Hola", idempotencyKey: "k-1" })).resolves.toEqual({
      messageId: "m-1",
    });
    expect(inserted).toHaveLength(1);
    expect(inserted[0]?.text).toMatch(/values \(\$1, \$2, 'out', 'agent', \$3, 'sent', \$4\)/);
    expect(inserted[0]?.values).toEqual(["org-1", "c-1", "Hola", "k-1"]);
  });

  it("si la base de datos lo rechaza porque la lleva una persona, lanza ConversationNotAgentModeError", async () => {
    const { db } = fakeDb({ code: NOT_AGENT_MODE_CODE });
    const sent = createConversationSender(db).send({ conversationId: "c-1", text: "Hola", idempotencyKey: "k-2" });
    await expect(sent).rejects.toBeInstanceOf(ConversationNotAgentModeError);
  });

  it("cualquier otro error sigue siendo un error de guardado", async () => {
    const { db } = fakeDb({ code: "23505" });
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
