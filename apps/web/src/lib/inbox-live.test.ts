import { describe, expect, it } from "vitest";
import { inboxTopics, liveEvent, sseMessage } from "./inbox-live";

// La bandeja en vivo (M-10, ADR 0054): el servidor escucha los temas privados
// de Realtime de la persona (#216) y reenvía al navegador solo identificadores.

const ORG = "5eed0000-0000-4000-8000-00000000000a";
const A1 = "5eed0002-0000-4000-8000-0000000000a1";
const A2 = "5eed0002-0000-4000-8000-0000000000a2";
const CONVERSATION = "5eed000b-0000-4000-8000-0000000000b2";
const MESSAGE = "5eed000c-0000-4000-8000-000000000001";

describe("inboxTopics", () => {
  it("el org_admin escucha cada local y lo de toda la organización", () => {
    expect(inboxTopics({ organizationId: ORG, role: "org_admin", locationIds: [A2, A1] })).toEqual([
      `inbox:${ORG}:${A1}`,
      `inbox:${ORG}:${A2}`,
      `inbox:${ORG}:org`,
    ]);
  });

  it("el resto, solo sus locales: lo de toda la organización no lo lee (can_see_scope)", () => {
    for (const role of ["region_manager", "location_manager", "staff"] as const) {
      expect(inboxTopics({ organizationId: ORG, role, locationIds: [A1] })).toEqual([`inbox:${ORG}:${A1}`]);
    }
  });

  it("sin organización o sin rol, ninguno", () => {
    expect(inboxTopics({ organizationId: null, role: "org_admin", locationIds: [A1] })).toEqual([]);
    expect(inboxTopics({ organizationId: ORG, role: null, locationIds: [A1] })).toEqual([]);
  });

  it("un id que no es un uuid no forma un tema", () => {
    expect(inboxTopics({ organizationId: ORG, role: "staff", locationIds: ["no-es-un-id", A1] })).toEqual([`inbox:${ORG}:${A1}`]);
    expect(inboxTopics({ organizationId: "x", role: "org_admin", locationIds: [A1] })).toEqual([]);
  });
});

describe("liveEvent", () => {
  it("de un aviso de la base de datos se queda solo con los identificadores", () => {
    expect(liveEvent("message", { op: "INSERT", conversation_id: CONVERSATION, message_id: MESSAGE, content: "hola" })).toEqual({
      type: "message",
      conversationId: CONVERSATION,
      messageId: MESSAGE,
    });
    expect(liveEvent("conversation", { op: "UPDATE", conversation_id: CONVERSATION })).toEqual({
      type: "conversation",
      conversationId: CONVERSATION,
    });
  });

  it.each([
    ["un evento desconocido", "spoof", { conversation_id: CONVERSATION }],
    ["sin conversación", "message", { op: "INSERT" }],
    ["una conversación que no es un uuid", "message", { conversation_id: "x' onload='" }],
    ["sin carga", "message", null],
  ])("%s no se reenvía", (_label, event, payload) => {
    expect(liveEvent(event, payload)).toBeNull();
  });

  it("un id de mensaje que no es un uuid se descarta, la conversación vale", () => {
    expect(liveEvent("message", { conversation_id: CONVERSATION, message_id: "x" })).toEqual({
      type: "message",
      conversationId: CONVERSATION,
    });
  });
});

describe("sseMessage", () => {
  it("escribe un evento de Server-Sent Events con datos JSON en una línea", () => {
    expect(sseMessage("message", { conversationId: CONVERSATION })).toBe(
      `event: message\ndata: {"conversationId":"${CONVERSATION}"}\n\n`,
    );
  });
});
