import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("une clases y descarta valores falsos", () => {
    expect(cn("flex", false, undefined, null, "gap-2")).toBe("flex gap-2");
  });

  it("la última clase de Tailwind en conflicto gana", () => {
    expect(cn("px-2 text-sm", "px-4")).toBe("text-sm px-4");
  });
});
