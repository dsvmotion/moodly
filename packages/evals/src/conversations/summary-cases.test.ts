import { describe, expect, it } from "vitest";
import { SUMMARY_MARK } from "@repo/agent-core";
import { conversationCases } from "./cases.js";
import { runCase, scriptedTransport } from "./runner.js";
import { createWorld } from "./world.js";

// Las conversaciones largas (PL-T3, #218): el resumen de lo anterior llega al
// modelo como dato, en su sitio, y solo en los casos que lo traen. Lo que hace
// el modelo con él lo miden los casos `recepcion-resumen-*` con el modelo real.

const withSummary = conversationCases.filter((c) => c.summary?.trim());
const withoutSummary = conversationCases.filter((c) => !c.summary?.trim());
const marked = (content: string) => content.startsWith(SUMMARY_MARK);

describe("el resumen en el turno (PL-T3)", () => {
  it("hay casos de conversación larga: datos solo en el resumen, una solicitud ya hecha, un resumen inyectado y quién dijo cada línea", () => {
    expect(withSummary.map((c) => c.id)).toEqual(
      expect.arrayContaining([
        "recepcion-resumen-no-confirma",
        "recepcion-resumen-en-ingles",
        "recepcion-resumen-pendiente-y-companera",
        "recepcion-resumen-lo-que-pidio",
        "recepcion-resumen-ya-pedida",
        "recepcion-resumen-inyectado",
        "recepcion-resumen-quien-lo-dijo",
      ]),
    );
    // Cada línea del resumen dice quién lo dijo, como lo escribe el resumidor.
    for (const c of withSummary) {
      for (const line of (c.summary ?? "").split("\n")) expect(line, c.id).toMatch(/^(Customer|Assistant|Team) said: /u);
    }
  });

  it.each(withSummary.map((c) => [c.id, c] as const))("%s: el resumen va una vez, marcado como dato, después del sistema y antes de los mensajes", async (_id, testCase) => {
    const transport = scriptedTransport([{ say: "Soy un asistente de IA: una persona del equipo te contestará." }]);
    await runCase(testCase, transport);
    const messages = transport.calls[0]?.messages ?? [];
    const summaries = messages.flatMap((message, index) => (message.role !== "system" && marked(message.content) ? [{ index, message }] : []));
    expect(summaries).toEqual([{ index: 2, message: { role: "user", content: `${SUMMARY_MARK}\n${testCase.summary?.trim()}` } }]);
    expect(messages.slice(0, 2).every((message) => message.role === "system")).toBe(true);
    // Nunca en el sistema (lo que cachea) ni en la parte volátil.
    expect(messages.filter((message) => message.role === "system").some((message) => message.content.includes(testCase.summary?.trim() ?? ""))).toBe(false);
  });

  it("sin resumen, ningún mensaje lleva la marca", async () => {
    for (const testCase of withoutSummary) {
      const transport = scriptedTransport([{ say: "Soy un asistente de IA." }]);
      await runCase(testCase, transport);
      expect(transport.calls[0]?.messages.some((message) => marked(message.content)), testCase.id).toBe(false);
    }
  });
});

describe("las solicitudes que esperan al equipo llegan al turno (CU3)", () => {
  // Los casos cuya historia trae una solicitud ya hecha y pendiente: el runtime
  // se la da al agente (como el worker, de executions en borrador), para que no
  // la vuelva a pedir y diga que espera al equipo.
  const PENDING = [
    "recepcion-resumen-pendiente-y-companera",
    "recepcion-resumen-quien-lo-dijo",
    "recepcion-resumen-ya-pedida",
    "recepcion-no-duplica-solicitud",
    // Cambia de idea con la de hoy aún pendiente: propone la nueva y no la pasa a una persona.
    "recepcion-cambia-de-idea",
  ];

  it.each(PENDING)("%s: la solicitud de láser de hoy va en la parte que cambia del prompt", async (id) => {
    const testCase = conversationCases.find((c) => c.id === id);
    if (!testCase) throw new Error(id);
    const transport = scriptedTransport(testCase.script(createWorld(testCase.agent)));
    const run = await runCase(testCase, transport);
    const system = transport.calls[0]?.messages.filter((m) => m.role === "system").map((m) => m.content) ?? [];
    expect(system[1]).toContain("## Requests waiting for the team in this conversation");
    expect(system[1]).toMatch(/- Reservar Láser diodo \(piernas\).*11:00/u);
    // Nunca en la parte estable (caché de prompt).
    expect(system[0]).not.toContain("Requests waiting for the team");
    expect(run.failures).toEqual([]);
  });

  it("sin solicitudes pendientes, el prompt no trae la sección", async () => {
    const others = conversationCases.filter((c) => !PENDING.includes(c.id));
    for (const testCase of others) {
      const run = await runCase(testCase);
      expect(run.outcome.world.systemPromptParts.volatile, testCase.id).not.toContain("Requests waiting for the team");
    }
  });
});
