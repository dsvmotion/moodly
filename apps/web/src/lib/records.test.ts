import { describe, expect, it } from "vitest";
import { summarizeOpeningHours, withRecord } from "./records";

const days = { mon: "L", tue: "M", wed: "X", thu: "J", fri: "V", sat: "S", sun: "D" };

describe("withRecord", () => {
  it("abre y cierra la vista previa conservando el alcance", () => {
    expect(withRecord("/app/ajustes/sedes?scope=all", "abc")).toBe("/app/ajustes/sedes?scope=all&record=abc");
    expect(withRecord("/app/ajustes/sedes?scope=all&record=abc", null)).toBe("/app/ajustes/sedes?scope=all");
    expect(withRecord("/app/ajustes/sedes?record=abc", null)).toBe("/app/ajustes/sedes");
  });
});

describe("summarizeOpeningHours", () => {
  it("resume los días con horario, en orden", () => {
    expect(summarizeOpeningHours({ tue: ["10:00", "14:00"], mon: ["09:00", "20:00"] }, days)).toBe(
      "L 09:00–20:00 · M 10:00–14:00",
    );
  });

  it.each([null, undefined, {}, [], "09:00", { mon: "09:00" }, { mon: ["9", "20"] }, { mon: ["09:00"] }, { xyz: ["09:00", "20:00"] }])(
    "%j → sin horario",
    (value) => {
      expect(summarizeOpeningHours(value, days)).toBeNull();
    },
  );
});
