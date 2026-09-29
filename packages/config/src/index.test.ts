import { describe, expect, it } from "vitest";
import { BRAND_NAME } from "./index.js";

describe("@repo/config", () => {
  it("expone BRAND_NAME no vacío", () => {
    expect(BRAND_NAME.trim()).not.toBe("");
  });
});
