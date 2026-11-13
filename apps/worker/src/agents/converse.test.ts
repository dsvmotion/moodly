import { HAND_OFF_TEXTS } from "@repo/agent-core";
import type { SkillDefinition, TurnResult } from "@repo/agent-core";
import type { Logger } from "pino";
import { describe, expect, it, vi } from "vitest";
import { createEventRegistry } from "../events/handlers.ts";
import {
  handOffTextFor,
  CONVERSE_HANDLER_KEY,
  MAX_PROMPT_SERVICES,
  agentAnswers,
  agentSkills,
  bookableServices,
  createConverseHandler,
  finalRunStatus,
  holdsForPerson,
  recordUsageSafely,
  runIdFor,
  runStatusFor,
  withSummaryUsage,
} from "./converse.ts";
import type { TurnContext } from "./converse.ts";

const usage = { tokensIn: 0, tokensOut: 0, costEur: 0, model: null, calls: [] };

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

  it("el run cuenta lo que costó el resumen continuo, y nada si no se hizo (PL-T3)", () => {
    const turn = { status: "replied", executions: [], usage: { tokensIn: 100, tokensOut: 10, costEur: 0.01, model: "m/smart", calls: [] } } as TurnResult;
    const updated = withSummaryUsage(turn, {
      kind: "updated",
      summary: "s",
      coveredUntil: "2030-06-03T09:00:00Z",
      usage: { tokensIn: 50, tokensOut: 5, costEur: 0.001, model: "m/fast" },
      call: { index: 1000, provider: "p", via: "gateway", region: "other", model: "m/fast", modelKey: "fast", tokensIn: 50, tokensOut: 5, costEur: 0.001, startedAt: "2030-06-03T09:00:00.000Z" },
    });
    expect(updated.usage).toEqual({ tokensIn: 150, tokensOut: 15, costEur: 0.011, model: "m/smart", calls: [] });
    expect(updated.status).toBe("replied");
    expect(withSummaryUsage(turn, { kind: "none" })).toBe(turn);
    expect(withSummaryUsage(turn, { kind: "skipped", reason: "budget" })).toBe(turn);
  });

  it("un mensaje del agente que iba a esperar aprobación se retiene si la conversación ya no la lleva él (R-02)", () => {
    const conversation = { kind: "conversation", conversationId: "c-1", contactId: "k-1" } as const;
    expect(holdsForPerson("external_message", conversation, "human")).toBe(true);
    expect(holdsForPerson("external_message", conversation, "closed")).toBe(true);
    expect(holdsForPerson("external_message", conversation, null)).toBe(true);
    expect(holdsForPerson("external_message", conversation, "agent")).toBe(false);
    // Una reserva en borrador sigue para el equipo: no es el agente hablando.
    expect(holdsForPerson("internal_write", conversation, "human")).toBe(false);
    expect(holdsForPerson("external_message", { kind: "none" }, "human")).toBe(false);
  });

  it("si lo que esperaba a una persona se retuvo, el run queda en manos de una persona y no esperando (R-02)", () => {
    const drafted = { status: "reply_drafted", executions: [], usage } as TurnResult;
    expect(finalRunStatus(drafted, true, false)).toBe("handed_off");
    // Si algo más sigue esperando (una reserva en borrador), espera.
    expect(finalRunStatus(drafted, true, true)).toBe("awaiting_approval");
    expect(finalRunStatus(drafted, false, false)).toBe("awaiting_approval");
    expect(finalRunStatus({ status: "replied", executions: [], usage } as TurnResult, true, false)).toBe("completed");
  });

  it("si el cliente escribió otra vez a mitad del turno, el run se cierra completed y no pasa la conversación a nadie (gate M1)", () => {
    // La respuesta autónoma falló porque ya no tocaba: el turno dice handed_off (reply_failed), pero no lo es.
    const failed = { status: "handed_off", reason: "reply_failed", executions: [], usage } as TurnResult;
    expect(finalRunStatus(failed, false, false, true)).toBe("completed");
    const drafted = { status: "reply_drafted", executions: [], usage } as TurnResult;
    expect(finalRunStatus(drafted, false, false, true)).toBe("completed");
    // Si otra cosa del turno sigue esperando a una persona (una reserva en borrador), espera.
    expect(finalRunStatus(drafted, false, true, true)).toBe("awaiting_approval");
    // También si la respuesta autónoma falló por el relevo: espera esa reserva, sin pasar la
    // conversación a una persona (si no, el turno del mensaje nuevo ya no contestaría).
    expect(finalRunStatus(failed, false, true, true)).toBe("awaiting_approval");
    // Sin superseded, lo de siempre.
    expect(finalRunStatus(failed, false, false)).toBe("handed_off");
  });

  it("un request_human que el turno relevado ya ejecutó se mantiene: pasa la conversación a una persona (gate M1)", () => {
    // El cliente pidió una persona (o el agente decidió pasarla): eso no lo deshace el relevo.
    const asked = {
      status: "handed_off",
      reason: "customer_asked",
      executions: [{ skillKey: "request_human", status: "executed", output: { reason: "customer_asked" } }],
      usage,
    } as unknown as TurnResult;
    expect(finalRunStatus(asked, false, false, true)).toBe("handed_off");
    // También con algo suyo pendiente (una reserva en borrador): la persona ve la conversación y lo pendiente.
    expect(finalRunStatus(asked, false, true, true)).toBe("handed_off");
    // Un request_human que no llegó a ejecutarse (rechazado o en borrador) no cuenta.
    const notRun = {
      status: "handed_off",
      reason: "reply_failed",
      executions: [{ skillKey: "request_human", status: "failed" }],
      usage,
    } as unknown as TurnResult;
    expect(finalRunStatus(notRun, false, false, true)).toBe("completed");
    expect(finalRunStatus(notRun, false, true, true)).toBe("awaiting_approval");
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
  // recordUsage escribe por SQL bajo RLS (forOrganization(org).transaction,
  // PL-T1 3c-1): la consulta de mentira responde como Postgres (filas o error).
  const dbWith = (query: (text: string, values?: readonly unknown[]) => Promise<unknown[]>) =>
    ({
      organizationId: "org-1",
      transaction: async <T>(fn: (sql: { query: typeof query }) => Promise<T>) => fn({ query }),
    }) as unknown as Parameters<typeof recordUsageSafely>[0];
  const pgError = (code: string) => Object.assign(new Error("pg"), { code });

  it("anota la llamada", async () => {
    const logger = { error: vi.fn() };
    const query = vi.fn(async () => [] as unknown[]);
    await expect(recordUsageSafely(dbWith(query), logger, "run-1", conversation, call)).resolves.toBe(true);
    expect(logger.error).not.toHaveBeenCalled();
    const [text, values] = query.mock.calls[0] as unknown as [string, unknown[]];
    expect(text).toMatch(/insert into public\.usage_records/);
    expect(values.slice(0, 4)).toEqual(["org-1", "loc-1", "run-1", "agent-1"]);
  });

  it("si ya estaba (un paso repetido), cuenta como anotada: on conflict do nothing, sin error", async () => {
    const logger = { error: vi.fn() };
    const query = vi.fn(async () => [] as unknown[]);
    await expect(recordUsageSafely(dbWith(query), logger, "run-1", conversation, call)).resolves.toBe(true);
    expect((query.mock.calls[0] as unknown as [string])[0]).toMatch(/on conflict do nothing/);
  });

  it.each([
    [
      "un error de la base de datos",
      async (): Promise<unknown[]> => {
        throw pgError("08006");
      },
    ],
    [
      "una excepción",
      async (): Promise<unknown[]> => {
        throw new Error("conexión cortada");
      },
    ],
  ])("con %s no lanza: lo registra como error con el run y devuelve false", async (_name, query) => {
    const logger = { error: vi.fn() };
    await expect(recordUsageSafely(dbWith(query), logger, "run-1", conversation, call)).resolves.toBe(false);
    expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ runId: "run-1", callIndex: 0 }), expect.stringContaining("libro de consumo"));
  });
});

describe("handOffTextFor (CU3)", () => {
  it("el texto del paso en el idioma de la organización: inglés con «en», si no, español", () => {
    expect(handOffTextFor("en-GB")).toBe(HAND_OFF_TEXTS.en);
    expect(handOffTextFor("es-ES")).toBe(HAND_OFF_TEXTS.es);
    expect(handOffTextFor("fr-FR")).toBe(HAND_OFF_TEXTS.es);
    expect(handOffTextFor(null)).toBe(HAND_OFF_TEXTS.es);
  });
});
