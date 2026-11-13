import { describe, expect, it } from "vitest";
import { durationMinutes, localDate, localDateTime, localToUtc, nextDate } from "./time.js";

describe("hora local del centro y UTC", () => {
  it("convierte una hora de Madrid en invierno y en verano", () => {
    expect(localToUtc("2026-11-13", "10:00", "Europe/Madrid")).toEqual(new Date("2026-11-13T09:00:00Z"));
    expect(localToUtc("2026-07-01", "10:00", "Europe/Madrid")).toEqual(new Date("2026-07-01T08:00:00Z"));
    expect(localToUtc("2026-11-13", "10:00:30", "Atlantic/Canary")).toEqual(new Date("2026-11-13T10:00:30Z"));
  });

  it("los días del cambio de hora", () => {
    // 2026-03-29: en Madrid se pasa de 02:00 a 03:00.
    expect(localToUtc("2026-03-29", "01:30", "Europe/Madrid")).toEqual(new Date("2026-03-29T00:30:00Z"));
    expect(localToUtc("2026-03-29", "03:30", "Europe/Madrid")).toEqual(new Date("2026-03-29T01:30:00Z"));
    // 2026-10-25: 02:30 ocurre dos veces; se toma una de las dos, nunca otra hora.
    const ambiguous = localToUtc("2026-10-25", "02:30", "Europe/Madrid")?.toISOString();
    expect(["2026-10-25T00:30:00.000Z", "2026-10-25T01:30:00.000Z"]).toContain(ambiguous);
  });

  it("lo que no tiene forma de fecha u hora es null", () => {
    for (const [d, t] of [["2026-02-30", "10:00"], ["mañana", "10:00"], ["2026-11-13", "25:00"], ["2026-11-13", "10h"]] as const) {
      expect(localToUtc(d, t, "Europe/Madrid")).toBeNull();
    }
  });

  it("la fecha y la fecha-hora locales de un instante", () => {
    const at = new Date("2026-11-13T23:30:00Z");
    expect(localDate(at, "Europe/Madrid")).toBe("2026-11-14");
    expect(localDateTime(at, "Europe/Madrid")).toBe("2026-11-14T00:30:00");
    expect(nextDate("2026-12-31")).toBe("2027-01-01");
  });

  it("las duraciones de Koibox", () => {
    expect(durationMinutes("00:45:00")).toBe(45);
    expect(durationMinutes("01:30")).toBe(90);
    expect(durationMinutes("00:00:00")).toBeNull();
    expect(durationMinutes("una hora")).toBeNull();
    expect(durationMinutes(null)).toBeNull();
  });
});
