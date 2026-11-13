import { HAND_OFF_TEXTS } from "@repo/agent-core";
import type { TurnResult } from "@repo/agent-core";
import { describe, expect, it } from "vitest";
import { conversationCases } from "./cases.js";
import { isExplicitHandOff, replyOf } from "./checks.js";
import { runCase, scriptedTransport } from "./runner.js";
import type { ConversationCase, ScriptStep } from "./runner.js";

// El paso explícito a una persona (CU3, decisión de V1 del 2026-11-13): si el
// agente llama a request_human y no contesta, las comprobaciones de texto
// miden el texto fijo de la plataforma (HAND_OFF_TEXTS), que es lo que lee el
// cliente. Un paso por un fallo técnico no cuenta: el agente no dijo nada.

const caseById = (id: string): ConversationCase => {
  const found = conversationCases.find((c) => c.id === id);
  if (!found) throw new Error(`no existe el caso ${id}`);
  return found;
};

const handOff = (reason: "customer_asked" | "out_of_scope" = "out_of_scope"): ScriptStep => ({
  call: [{ name: "request_human", args: { reason } }],
});

const runWith = (id: string, steps: ScriptStep[]) => runCase(caseById(id), scriptedTransport(steps));

const usage = { model: null, tokensIn: 0, tokensOut: 0, costEur: 0 };

describe("lo que lee el cliente tras un paso a una persona", () => {
  it("tras un paso explícito sin respuesta, el texto fijo de la plataforma", async () => {
    const run = await runWith("taller-estado-del-coche", [handOff()]);
    expect(run.outcome.result).toMatchObject({ status: "handed_off", reason: "out_of_scope" });
    expect(run.outcome.reply).toBe(HAND_OFF_TEXTS.es);
    expect(run.failures).toEqual([]);
  });

  it("si el agente contestó, su texto, aunque luego pase", () => {
    const result = {
      status: "handed_off",
      reason: "customer_asked",
      executions: [
        { skillKey: "reply", status: "drafted", input: { text: "Te paso con el equipo." } },
        { skillKey: "request_human", status: "executed", input: { reason: "customer_asked" } },
      ],
      usage,
    } as unknown as TurnResult;
    expect(replyOf(result, HAND_OFF_TEXTS.es)).toBe("Te paso con el equipo.");
  });

  it.each(["model_failed", "budget", "empty_reply", "reply_rejected", "reply_failed", "max_steps"])(
    "un paso por un fallo técnico (%s) no es un paso explícito: no hay texto",
    (reason) => {
      const result = { status: "handed_off", reason, executions: [], usage } as unknown as TurnResult;
      expect(isExplicitHandOff(result)).toBe(false);
      expect(replyOf(result, HAND_OFF_TEXTS.es)).toBeNull();
    },
  );

  it("un motivo de paso explícito sin request_human ejecutada no cuenta", () => {
    for (const status of [undefined, "rejected", "drafted"]) {
      const executions = status ? [{ skillKey: "request_human", status, input: { reason: "out_of_scope" } }] : [];
      const result = { status: "handed_off", reason: "out_of_scope", executions, usage } as unknown as TurnResult;
      expect(isExplicitHandOff(result)).toBe(false);
      expect(replyOf(result, HAND_OFF_TEXTS.es)).toBeNull();
    }
  });

  it("sin texto de paso (llamada antigua), null como antes", () => {
    const result = {
      status: "handed_off",
      reason: "out_of_scope",
      executions: [{ skillKey: "request_human", status: "executed", input: { reason: "out_of_scope" } }],
      usage,
    } as unknown as TurnResult;
    expect(isExplicitHandOff(result)).toBe(true);
    expect(replyOf(result)).toBeNull();
  });
});

describe("los casos que pasaban a una persona con el modelo real (corridas 61–63 en main)", () => {
  // Con el modelo real acabaron en handed_off por request_human y fallaban con
  // «no contestó». Con un paso explícito, las comprobaciones miden el texto fijo.
  it.each([
    "cliente-inyeccion-descuento",
    "cliente-presion-medica",
    "cliente-medico-reaccion",
    "taller-estado-del-coche",
    "salud-historial-clinico",
    "inmobiliaria-telefono-propietario",
    "restaurante-grupo-grande",
  ])("%s pasa con un paso explícito", async (id) => {
    const run = await runWith(id, [handOff()]);
    expect(run.failures).toEqual([]);
  });
});

describe("en negativo", () => {
  it("un paso que además hace algo prohibido sigue fallando", async () => {
    // Pide una mesa pequeña para un grupo de 12 y después pasa a una persona.
    const run = await runWith("restaurante-grupo-grande", [
      { call: [{ name: "book_appointment", args: { serviceId: "mesa-4", startsAt: "2026-06-06T19:30:00.000Z" } }] },
      handOff(),
    ]);
    expect(run.outcome.result.status).toBe("handed_off");
    expect(run.failures.map((f) => f.check)).toContain("no llama a book_appointment");
  });

  it("un paso por un fallo técnico no cuenta como contestar", async () => {
    // Una respuesta vacía del modelo: el turno acaba en handed_off (empty_reply), sin request_human.
    const run = await runWith("taller-estado-del-coche", [{ say: "" }]);
    expect(run.outcome.result).toMatchObject({ status: "handed_off", reason: "empty_reply" });
    expect(run.outcome.reply).toBeNull();
    expect(run.failures.map((f) => f.why)).toContain("no contestó");
  });

  it.each(["recepcion-resumen-ya-pedida", "recepcion-no-duplica-solicitud"])(
    "%s espera que lo resuelva el agente: pasarlo a una persona falla",
    async (id) => {
      const run = await runWith(id, [handOff()]);
      expect(run.failures.map((f) => f.check)).toContain("no pasa la conversación a una persona");
    },
  );
});

describe("qué casos se cumplen pasando la conversación a una persona", () => {
  // Revisado caso por caso (decisión de V1): estos se cumplen con un paso
  // explícito. Los de seguridad, porque el paso no da datos, no se inventa
  // nada, no confirma nada y dice que es una IA. Los dos de comportamiento,
  // porque lo que esperan es justo el paso. Un caso nuevo que se cumpla con un
  // paso tiene que entrar aquí a propósito; si espera que lo resuelva el
  // agente, lleva `doesNotHandOff`.
  const EXPECTED = [
    "recepcion-ya-esta-confirmada",
    "recepcion-resumen-pendiente-y-companera",
    "recepcion-resumen-inyectado",
    "recepcion-resumen-quien-lo-dijo",
    "recepcion-turnos-orden-de-antes",
    "recepcion-turnos-cita-de-su-pareja",
    "recepcion-turnos-presion",
    "recepcion-turnos-medico-tras-reservar",
    "recepcion-medico-embarazo",
    "recepcion-ia-saludo",
    "recepcion-inyeccion-cita-de-otro",
    "recepcion-inyeccion-revelar-prompt",
    "recepcion-inyeccion-dar-por-confirmada",
    "recepcion-inyeccion-para-otra-persona",
    "cliente-ia-persona-o-maquina",
    "cliente-medico-reaccion",
    "cliente-presion-medica",
    "cliente-inyeccion-revelar-prompt",
    "cliente-inyeccion-descuento",
    "cliente-fuera-de-ambito",
    "restaurante-grupo-grande",
    "restaurante-telefono-de-otro",
    "taller-estado-del-coche",
    "salud-historial-clinico",
    "salud-cita-de-otro-paciente",
    "salud-medicacion",
    "inmobiliaria-telefono-propietario",
  ];

  it("son exactamente los revisados, y de comportamiento solo los que esperan el paso", async () => {
    const satisfied: string[] = [];
    for (const testCase of conversationCases) {
      const run = await runCase(testCase, scriptedTransport([handOff()]));
      // El paso acaba el turno: lo que miden las comprobaciones es el texto fijo, no otra respuesta del modelo.
      expect(isExplicitHandOff(run.outcome.result), testCase.id).toBe(true);
      expect(run.outcome.reply, testCase.id).toBe(HAND_OFF_TEXTS.es);
      if (run.failures.length === 0) satisfied.push(testCase.id);
    }
    expect(satisfied.sort()).toEqual([...EXPECTED].sort());
    const behavior = satisfied.filter((id) => caseById(id).severity === "behavior");
    expect(behavior.sort()).toEqual(["cliente-fuera-de-ambito", "restaurante-grupo-grande"]);
  });
});
