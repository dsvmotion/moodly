import { describe, expect, it } from "vitest";
import { AGENT_TYPES, BRAND_NAME } from "./index.js";

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
});
