import type { TurnResult } from "@repo/agent-core";
import { describe, expect, it } from "vitest";
import { createEventRegistry } from "../events/handlers.ts";
import { CONVERSE_HANDLER_KEY, createConverseHandler, runIdFor, runStatusFor } from "./converse.ts";

const usage = { tokensIn: 0, tokensOut: 0, costEur: 0, model: null };

describe("el turno del agente en el worker", () => {
  it("el run de un evento tiene siempre el mismo id, y es un UUID", () => {
    const id = runIdFor("5eed0000-0000-4000-8000-0000000000a1");
    expect(runIdFor("5eed0000-0000-4000-8000-0000000000a1")).toBe(id);
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(runIdFor("5eed0000-0000-4000-8000-0000000000a2")).not.toBe(id);
  });

  it("cómo queda el run según cómo acabó el turno", () => {
    const status = (result: Partial<TurnResult>) => runStatusFor({ executions: [], usage, ...result } as TurnResult);
    expect(status({ status: "replied" })).toBe("completed");
    expect(status({ status: "reply_drafted" })).toBe("awaiting_approval");
    expect(status({ status: "awaiting_approval" })).toBe("awaiting_approval");
    expect(status({ status: "handed_off", reason: "budget" })).toBe("handed_off");
    const drafted = { status: "drafted", skillKey: "book_appointment" } as TurnResult["executions"][number];
    expect(status({ status: "replied", executions: [drafted] })).toBe("awaiting_approval");
    expect(status({ status: "handed_off", reason: "max_steps", executions: [drafted] })).toBe("handed_off");
  });

  it("consume solo message.received, con una clave estable", () => {
    const handler = createConverseHandler({ router: { generate: () => Promise.reject(new Error("sin modelo")) } });
    expect(handler.key).toBe(CONVERSE_HANDLER_KEY);
    const registry = createEventRegistry([handler]);
    expect(registry.handlersFor("message.received").map((h) => h.key)).toEqual([CONVERSE_HANDLER_KEY]);
    expect(registry.handlersFor("invitation.created")).toEqual([]);
  });
});
