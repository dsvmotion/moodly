import { describe, expect, it } from "vitest";
import { displayName, initials } from "./user-display";

describe("initials", () => {
  it.each([
    ["Admin A", "a@demo.test", "AA"],
    ["María José López", "m@demo.test", "ML"],
    ["Staff", "s@demo.test", "S"],
    ["  ana   pérez  ", "a@demo.test", "AP"],
    ["Ítalo Ñúñez", "i@demo.test", "ÍÑ"],
  ])("con nombre %j → %j", (name, email, expected) => {
    expect(initials(name, email)).toBe(expected);
  });

  it.each([
    [null, "invitado@demo.test", "IN"],
    ["", "m.freno@demo.test", "MF"],
    ["   ", "x@demo.test", "X"],
    [undefined, "@demo.test", "?"],
  ])("sin nombre (%j) usa el email %j → %j", (name, email, expected) => {
    expect(initials(name, email)).toBe(expected);
  });
});

describe("displayName", () => {
  it("prefiere el nombre y cae al email si falta o está vacío", () => {
    expect(displayName("Admin A", "a@demo.test")).toBe("Admin A");
    expect(displayName("  ", "a@demo.test")).toBe("a@demo.test");
    expect(displayName(null, "a@demo.test")).toBe("a@demo.test");
  });
});
