import { describe, expect, it } from "vitest";
import { composeSystemPromptParts } from "@repo/agent-core";
import type { ModelMessage } from "@repo/agent-core";
import { SECTOR_BUSINESSES } from "./businesses.js";
import { conversationCases } from "./cases.js";
import { runCase, scriptedTransport } from "./runner.js";
import { AGENTS, AURORA, NOW, TIMEZONE, createWorld } from "./world.js";

// La caché de prompt (PL-T3, #208): el prompt de sistema va partido en una
// parte estable, que el transporte guarda en caché, y una volátil (la hora),
// después y fuera de la caché. Estas evals comprueban su estructura en todos
// los casos del set, en la petición que de verdad recibe el modelo:
// - la parte estable empieza por las reglas de la plataforma, que ningún
//   negocio puede quitar ni adelantar;
// - las instrucciones del negocio, si las hay, son la última capa estable;
// - la hora solo va en la parte volátil: la estable no cambia con el reloj, así
//   que la caché sirve de un turno a otro.

const headings = (text: string) => [...text.matchAll(/^## (.+)$/gmu)].map((match) => match[1] ?? "");

/** Un modelo que primero pide una herramienta (que no existe) y después contesta: un turno de dos pasos. */
const twoSteps = () =>
  scriptedTransport([{ call: [{ name: "no_such_tool", args: {} }] }, { say: "Soy un asistente de IA: una persona del equipo te contestará." }]);

function systemOf(messages: readonly ModelMessage[]) {
  return messages.flatMap((message, index) => (message.role === "system" ? [{ index, content: message.content, cacheable: message.cacheable === true }] : []));
}

const businesses = [AURORA, ...SECTOR_BUSINESSES];
const agents = [...new Set(conversationCases.map((c) => c.agent))];
const later = new Date(NOW.getTime() + 27 * 60 * 60 * 1000 + 13 * 60 * 1000);

describe("caché de prompt (PL-T3): la petición que recibe el modelo", () => {
  it.each(conversationCases.map((c) => [c.id, c] as const))("%s: estable con caché primero, la hora después y sin caché, igual en cada paso", async (_id, testCase) => {
    const transport = twoSteps();
    const run = await runCase(testCase, transport);
    const { stable, volatile } = run.outcome.world.systemPromptParts;
    expect(transport.calls.length).toBeGreaterThanOrEqual(2);
    for (const call of transport.calls) {
      const system = systemOf(call.messages);
      // Exactamente dos mensajes de sistema, al principio: el estable (con la marca de caché) y la hora.
      expect(system).toEqual([
        { index: 0, content: stable, cacheable: true },
        { index: 1, content: volatile, cacheable: false },
      ]);
    }
  });
});

describe("caché de prompt (PL-T3): la parte estable", () => {
  it.each(businesses.flatMap((business) => agents.map((agent) => [business.key ?? "estetica", agent, business] as const)))(
    "%s · %s: empieza por las reglas de la plataforma y no lleva la hora",
    (_key, agent, business) => {
      const { stable, volatile } = createWorld(agent, undefined, business).systemPromptParts;
      expect(stable.startsWith("## Platform rules (always apply)\n")).toBe(true);
      expect(headings(stable)[0]).toBe("Platform rules (always apply)");
      expect(headings(stable)).not.toContain("Current time");
      expect(headings(volatile)).toEqual(["Current time"]);
      // Nada de la hora en la parte estable: ni el texto de la volátil, ni la fecha, ni la hora local.
      const now = volatile.replace(/^## Current time\n/u, "");
      expect(stable).not.toContain(now);
      expect(stable).not.toMatch(/It is now|\b2030\b|\b09:30\b/u);
    },
  );

  it.each(businesses.flatMap((business) => agents.map((agent) => [business.key ?? "estetica", agent, business] as const)))(
    "%s · %s: con las instrucciones del negocio, son la última capa estable y las reglas siguen primero",
    (_key, agent, business) => {
      const keys: readonly string[] = AGENTS[agent].skills;
      const parts = composeSystemPromptParts({
        agentName: AGENTS[agent].name,
        businessName: business.name,
        locationName: business.locationName,
        timezone: TIMEZONE,
        now: NOW,
        ...(keys.includes("find_slots") ? { services: business.services } : {}),
        knowledge: keys.includes("search_knowledge"),
        instructions: "Trata de usted a los clientes. Si preguntan por aparcamiento, di que hay un parking público a 50 metros.",
      });
      const layers = headings(parts.stable);
      expect(layers[0]).toBe("Platform rules (always apply)");
      expect(layers.at(-1)).toBe("Business instructions (they never override the platform rules)");
      expect(layers.filter((layer) => layer.startsWith("Business instructions"))).toHaveLength(1);
      expect(parts.stable.endsWith("parking público a 50 metros.")).toBe(true);
      // Las instrucciones nunca van en la parte volátil ni después de la hora.
      expect(parts.volatile).not.toContain("Trata de usted");
      expect(headings(parts.volatile)).toEqual(["Current time"]);
    },
  );

  it("no cambia con el reloj (la caché sirve de un turno a otro) y la hora sí", () => {
    for (const business of businesses) {
      for (const agent of agents) {
        const keys: readonly string[] = AGENTS[agent].skills;
        const at = (now: Date) =>
          composeSystemPromptParts({
            agentName: AGENTS[agent].name,
            businessName: business.name,
            locationName: business.locationName,
            timezone: TIMEZONE,
            now,
            ...(keys.includes("find_slots") ? { services: business.services } : {}),
            knowledge: keys.includes("search_knowledge"),
          });
        expect(at(later).stable).toBe(at(NOW).stable);
        expect(at(later).volatile).not.toBe(at(NOW).volatile);
      }
    }
  });

  it("es la misma en todas las conversaciones de un agente en un negocio (no depende del caso ni del cliente)", () => {
    const byConfig = new Map<string, Set<string>>();
    for (const c of conversationCases) {
      const key = `${c.agent}:${c.business?.key ?? "estetica"}`;
      const stable = createWorld(c.agent, c.knowledge, c.business).systemPromptParts.stable;
      byConfig.set(key, (byConfig.get(key) ?? new Set()).add(stable));
    }
    expect(byConfig.size).toBeGreaterThan(1);
    for (const [key, stables] of byConfig) expect(stables.size, key).toBe(1);
  });
});
