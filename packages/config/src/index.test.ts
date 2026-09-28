import { describe, expect, it } from "vitest";

describe("@repo/config", () => {
  it("el módulo carga como ESM", async () => {
    const mod = await import("./index.js");
    expect(mod).toBeTypeOf("object");
  });
});
