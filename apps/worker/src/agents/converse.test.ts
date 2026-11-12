import type { SkillDefinition, TurnResult } from "@repo/agent-core";
import type { Logger } from "pino";
import { describe, expect, it, vi } from "vitest";
import { createEventRegistry } from "../events/handlers.ts";
import {
  CONVERSE_HANDLER_KEY,
  MAX_PROMPT_SERVICES,
  agentAnswers,
  agentSkills,
  bookableServices,
  createConverseHandler,
  recordUsageSafely,
  runIdFor,
  runStatusFor,
} from "./converse.ts";
import type { TurnContext } from "./converse.ts";

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

describe("cuándo contesta el agente", () => {
  it("en live y en testing, en cualquier canal", () => {
    for (const channel of ["webchat", "whatsapp", "test", null]) {
      expect(agentAnswers("live", channel)).toBe(true);
      expect(agentAnswers("testing", channel)).toBe(true);
    }
  });

  it("en draft, solo en el chat de pruebas de la app: se prueba antes de publicarlo", () => {
    expect(agentAnswers("draft", "test")).toBe(true);
    for (const channel of ["webchat", "whatsapp", "voice", null]) expect(agentAnswers("draft", channel)).toBe(false);
  });

  it("en pausa, nunca, ni en el chat de pruebas", () => {
    for (const channel of ["webchat", "test", null]) expect(agentAnswers("paused", channel)).toBe(false);
  });
});

describe("lo que se puede reservar en el prompt", () => {
  const CENTRO = "a2000000-0000-4000-8000-000000000001";
  const NORTE = "a2000000-0000-4000-8000-000000000002";
  const row = (id: string, name: string, location_id: string | null) => ({ id, name, duration_minutes: 30, location_id });

  it("los de toda la organización y los de su local, por nombre; nunca los de otro local", () => {
    const { services, truncated } = bookableServices(
      [row("s3", "Uñas", CENTRO), row("s1", "Láser", null), row("s2", "Masaje", NORTE), row("s4", "Depilación", null)],
      CENTRO,
    );
    expect(services.map((service) => service.name)).toEqual(["Depilación", "Láser", "Uñas"]);
    expect(services[0]).toEqual({ id: "s4", name: "Depilación", durationMinutes: 30 });
    expect(truncated).toBe(false);
  });

  it("sin local no hay nada que reservar (find_slots lo exige)", () => {
    expect(bookableServices([row("s1", "Láser", null)], null)).toEqual({ services: [], truncated: false });
  });

  it("como mucho los que caben, y avisa si hay más", () => {
    const many = Array.from({ length: MAX_PROMPT_SERVICES + 1 }, (_, i) => row(`s${String(i).padStart(3, "0")}`, `Servicio ${String(i).padStart(3, "0")}`, null));
    const { services, truncated } = bookableServices(many, CENTRO);
    expect(services).toHaveLength(MAX_PROMPT_SERVICES);
    expect(truncated).toBe(true);
  });
});

describe("las herramientas que ve el modelo", () => {
  const findSlots = { key: "find_slots", version: 1, effectClass: "read" } as unknown as SkillDefinition<unknown>;
  const row = (key: string, effect_class: TurnContext["skills"][number]["effect_class"]): TurnContext["skills"][number] => ({
    key,
    version: 1,
    kind: "code",
    effect_class,
    enabled: true,
    autonomy_level: "execute",
  });

  it("los recordatorios y las ofertas de la lista de espera no: los lanza la plataforma, y no es un fallo que no estén entre las del modelo", () => {
    const warn = vi.fn();
    const log = { warn } as unknown as Logger;
    const { skills, settings } = agentSkills(
      new Map([["find_slots", findSlots]]),
      [
        row("find_slots", "read"),
        row("appointment_reminder", "external_outreach"),
        row("waitlist_offer", "external_outreach"),
        row("una_que_no_existe", "read"),
      ],
      log,
    );
    expect([...skills.keys()]).toEqual(["find_slots"]);
    expect([...settings.keys()]).toEqual(["find_slots"]);
    // Solo avisa de la que de verdad falta.
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toMatchObject({ skillKey: "una_que_no_existe" });
  });
});

describe("el libro de consumo durante el turno (PL-ledger)", () => {
  const conversation = { id: "conv-1", location_id: "loc-1", contact_id: "ana", agent_id: "agent-1" };
  const call = {
    index: 0,
    provider: "anthropic",
    via: "gateway",
    region: "other",
    model: "anthropic/claude-opus-5.5",
    modelKey: "smart",
    tokensIn: 100,
    tokensOut: 20,
    costEur: 0.001,
    startedAt: "2026-11-12T08:30:00.000Z",
  };
  const dbWith = (insert: () => Promise<{ error: { code: string } | null }>) =>
    ({ from: () => ({ insert }) }) as unknown as Parameters<typeof recordUsageSafely>[0];

  it("anota la llamada", async () => {
    const logger = { error: vi.fn() };
    await expect(recordUsageSafely(dbWith(async () => ({ error: null })), logger, "run-1", conversation, call)).resolves.toBe(true);
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("si ya estaba (23505, un paso repetido), cuenta como anotada", async () => {
    const logger = { error: vi.fn() };
    await expect(recordUsageSafely(dbWith(async () => ({ error: { code: "23505" } })), logger, "run-1", conversation, call)).resolves.toBe(true);
  });

  it.each([
    ["un error de la base de datos", async () => ({ error: { code: "08006" } })],
    [
      "una excepción",
      async () => {
        throw new Error("conexión cortada");
      },
    ],
  ])("con %s no lanza: lo registra como error con el run y devuelve false", async (_name, insert) => {
    const logger = { error: vi.fn() };
    await expect(recordUsageSafely(dbWith(insert), logger, "run-1", conversation, call)).resolves.toBe(false);
    expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ runId: "run-1", callIndex: 0 }), expect.stringContaining("libro de consumo"));
  });
});
