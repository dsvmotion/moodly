import { describe, expect, it } from "vitest";
import { WAIT_LIMIT_MS, isWaiting, testChatErrorFor, type TestChatMessage, type TestChatRun } from "./test-chat";

const now = new Date("2030-06-03T10:00:00Z");
const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();
const message = (id: string, author: TestChatMessage["author"], createdAt: string): TestChatMessage => ({ id, author, content: "x", createdAt });
const run = (messageId: string, status: string, steps: TestChatRun["steps"] = []): TestChatRun => ({ id: `run-${messageId}`, messageId, status, steps });

describe("cuándo espera la pantalla al agente", () => {
  it("si el último mensaje de la persona aún no tiene run, o sigue en marcha", () => {
    const messages = [message("m1", "contact", ago(5_000))];
    expect(isWaiting(messages, [], now)).toBe(true);
    expect(isWaiting(messages, [run("m1", "running")], now)).toBe(true);
  });

  it("no, si su run ya terminó, como acabe", () => {
    const messages = [message("m1", "contact", ago(5_000))];
    for (const status of ["completed", "awaiting_approval", "handed_off", "failed"]) {
      expect(isWaiting(messages, [run("m1", status)], now)).toBe(false);
    }
  });

  it("mira el último de la persona, no uno anterior ya contestado", () => {
    const messages = [message("m1", "contact", ago(60_000)), message("a1", "agent", ago(50_000)), message("m2", "contact", ago(1_000))];
    expect(isWaiting(messages, [run("m1", "completed")], now)).toBe(true);
    expect(isWaiting(messages, [run("m1", "completed"), run("m2", "completed")], now)).toBe(false);
  });

  it("deja de esperar pasado el límite, aunque el worker no conteste", () => {
    expect(isWaiting([message("m1", "contact", ago(WAIT_LIMIT_MS + 1))], [], now)).toBe(false);
    expect(isWaiting([message("m1", "contact", ago(WAIT_LIMIT_MS - 1))], [], now)).toBe(true);
  });

  it("si algo recién aprobado aún no se ha ejecutado, espera a que el worker lo haga", () => {
    const step = (status: string, approval: string) => ({ id: "s", skillKey: "reply", status, summary: null, approval: { id: "a", status: approval } });
    const messages = [message("m1", "contact", ago(WAIT_LIMIT_MS * 10))];
    expect(isWaiting(messages, [run("m1", "awaiting_approval", [step("drafted", "approved")])], now)).toBe(true);
    expect(isWaiting(messages, [run("m1", "completed", [step("executed", "approved")])], now)).toBe(false);
    expect(isWaiting(messages, [run("m1", "awaiting_approval", [step("drafted", "pending")])], now)).toBe(false);
    expect(isWaiting(messages, [run("m1", "completed", [step("rejected", "rejected")])], now)).toBe(false);
  });

  it("sin mensajes, nada que esperar", () => {
    expect(isWaiting([], [], now)).toBe(false);
  });
});

describe("el error que ve quien prueba", () => {
  it("traduce cada código de send_test_message", () => {
    expect(testChatErrorFor("22023")).toBe("invalid");
    expect(testChatErrorFor("42501")).toBe("not_allowed");
    expect(testChatErrorFor("P0002")).toBe("not_allowed");
    expect(testChatErrorFor("55000")).toBe("paused");
    expect(testChatErrorFor("54000")).toBe("too_many");
  });

  it("cualquier otro, un fallo genérico", () => {
    expect(testChatErrorFor("XX000")).toBe("failed");
    expect(testChatErrorFor(undefined)).toBe("failed");
  });
});
