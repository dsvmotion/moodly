import { describe, expect, it, vi } from "vitest";
import { createIdleTimer, IDLE_CLOSE_MS, inboxTopics, liveEvent, sseMessage } from "./inbox-live";

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

// V1 (coste del relé, ADR 0054): sin actividad en la pestaña durante 15 min,
// la conexión se cierra; con la siguiente actividad se abre otra y se relee.
describe("createIdleTimer", () => {
  it("pasa a inactiva tras el tiempo sin actividad, una sola vez", () => {
    vi.useFakeTimers();
    const onIdle = vi.fn();
    const onActive = vi.fn();
    const idle = createIdleTimer({ timeoutMs: IDLE_CLOSE_MS, onIdle, onActive });
    vi.advanceTimersByTime(IDLE_CLOSE_MS - 1);
    expect(onIdle).not.toHaveBeenCalled();
    expect(idle.isIdle()).toBe(false);
    vi.advanceTimersByTime(1);
    expect(onIdle).toHaveBeenCalledTimes(1);
    expect(idle.isIdle()).toBe(true);
    vi.advanceTimersByTime(IDLE_CLOSE_MS * 3);
    expect(onIdle).toHaveBeenCalledTimes(1);
    expect(onActive).not.toHaveBeenCalled();
    idle.stop();
    vi.useRealTimers();
  });

  it("la actividad vuelve a contar desde cero", () => {
    vi.useFakeTimers();
    const onIdle = vi.fn();
    const idle = createIdleTimer({ timeoutMs: 1_000, onIdle, onActive: vi.fn(), throttleMs: 0 });
    vi.advanceTimersByTime(900);
    idle.activity();
    vi.advanceTimersByTime(900);
    expect(onIdle).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);
    expect(onIdle).toHaveBeenCalledTimes(1);
    idle.stop();
    vi.useRealTimers();
  });

  it("al volver la actividad tras estar inactiva, avisa (para abrir y releer) y vuelve a contar", () => {
    vi.useFakeTimers();
    const onIdle = vi.fn();
    const onActive = vi.fn();
    const idle = createIdleTimer({ timeoutMs: 1_000, onIdle, onActive, throttleMs: 0 });
    vi.advanceTimersByTime(1_000);
    idle.activity();
    expect(onActive).toHaveBeenCalledTimes(1);
    expect(idle.isIdle()).toBe(false);
    idle.activity();
    expect(onActive).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1_000);
    expect(onIdle).toHaveBeenCalledTimes(2);
    idle.stop();
    vi.useRealTimers();
  });

  it("mucha actividad seguida (mover el ratón) no reprograma el temporizador cada vez", () => {
    vi.useFakeTimers();
    const clearSpy = vi.spyOn(globalThis, "clearTimeout");
    const idle = createIdleTimer({ timeoutMs: 60_000, onIdle: vi.fn(), onActive: vi.fn(), throttleMs: 5_000 });
    const before = clearSpy.mock.calls.length;
    for (let i = 0; i < 100; i++) idle.activity();
    expect(clearSpy.mock.calls.length - before).toBe(0);
    vi.advanceTimersByTime(5_000);
    idle.activity();
    expect(clearSpy.mock.calls.length - before).toBe(1);
    idle.stop();
    clearSpy.mockRestore();
    vi.useRealTimers();
  });

  it("después de parar, no avisa", () => {
    vi.useFakeTimers();
    const onIdle = vi.fn();
    const idle = createIdleTimer({ timeoutMs: 1_000, onIdle, onActive: vi.fn() });
    idle.stop();
    vi.advanceTimersByTime(5_000);
    expect(onIdle).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
