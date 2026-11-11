import { describe, expect, it } from "vitest";
import {
  AGENT_TYPES,
  BRAND_NAME,
  DEFAULT_CONVERSE_MODEL_BY_AGENT,
  DEFAULT_MODEL_BY_TASK,
  GATEWAY_MODELS,
  converseModelForAgentType,
} from "./index.js";

describe("@repo/config", () => {
  it("expone BRAND_NAME no vacío", () => {
    expect(BRAND_NAME.trim()).not.toBe("");
  });

  describe("AGENT_TYPES", () => {
    it("son 4 tipos con claves únicas en minúscula", () => {
      expect(AGENT_TYPES).toHaveLength(4);
      const keys = AGENT_TYPES.map((a) => a.key);
      expect(new Set(keys).size).toBe(4);
      for (const key of keys) expect(key).toMatch(/^[a-z]+$/);
    });

    it("cada tipo tiene nombre y token de color de marca", () => {
      for (const t of AGENT_TYPES) {
        expect(t.name.trim()).not.toBe("");
        expect(t.color).toMatch(/^agent-[a-z]+$/);
      }
    });
  });

  describe("DEFAULT_CONVERSE_MODEL_BY_AGENT (producto, 2026-11-11: la clave más barata que pasa las evals)", () => {
    it("Atención al cliente conversa con fast y Recepción con smart (eval B-01)", () => {
      expect(DEFAULT_CONVERSE_MODEL_BY_AGENT.customer).toBe("fast");
      expect(DEFAULT_CONVERSE_MODEL_BY_AGENT.reception).toBe("smart");
    });

    it("cada agente tiene una clave de conversar que existe en el gateway, nunca la de embeddings", () => {
      expect(Object.keys(DEFAULT_CONVERSE_MODEL_BY_AGENT).sort()).toEqual(AGENT_TYPES.map((t) => t.key).sort());
      for (const key of Object.values(DEFAULT_CONVERSE_MODEL_BY_AGENT)) {
        expect(key).not.toBe("embedding");
        expect(GATEWAY_MODELS[key]).toBeDefined();
      }
    });

    it("converseModelForAgentType: la de cada tipo de serie; nada para un tipo propio o una clave rara", () => {
      for (const t of AGENT_TYPES) expect(converseModelForAgentType(t.key)).toBe(DEFAULT_CONVERSE_MODEL_BY_AGENT[t.key]);
      for (const other of ["recepcion", "Reception", "", "mi_agente", "toString", "__proto__", "constructor"]) {
        expect(converseModelForAgentType(other)).toBeUndefined();
      }
    });

    it("sin agente, conversar sigue en el por defecto de la tarea", () => {
      expect(DEFAULT_MODEL_BY_TASK.converse).toBe("smart");
    });
  });
});
