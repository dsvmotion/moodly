import { describe, expect, it } from "vitest";
import {
  calendarDays,
  calendarHref,
  formatClock,
  groupByDay,
  localDate,
  parseDate,
  parseView,
  queryWindow,
  startOfDayIn,
  stepDate,
  todayIn,
  type CalendarAppointment,
} from "./calendar";

const appointment = (overrides: Partial<CalendarAppointment>): CalendarAppointment => ({
  id: "a",
  locationId: "madrid",
  startsAt: "2026-11-14T09:00:00.000Z",
  endsAt: "2026-11-14T09:30:00.000Z",
  status: "booked",
  bookedBy: "agent",
  service: "Corte",
  resource: "Laura",
  contact: "Lucía",
  ...overrides,
});

describe("parseView y parseDate", () => {
  it("solo «week» es semana; lo demás, día", () => {
    expect(parseView("week")).toBe("week");
    expect(parseView("day")).toBe("day");
    expect(parseView(["week"])).toBe("day");
    expect(parseView(undefined)).toBe("day");
  });
  it("acepta fechas reales y rechaza el resto", () => {
    expect(parseDate("2026-02-28", "x")).toBe("2026-02-28");
    expect(parseDate("2028-02-29", "x")).toBe("2028-02-29");
    for (const bad of ["2026-02-29", "2026-13-01", "2026-1-01", "hoy", "", undefined, ["2026-02-01"]]) {
      expect(parseDate(bad, "fallback")).toBe("fallback");
    }
  });
});

describe("días visibles", () => {
  it("el día es solo ese día", () => {
    expect(calendarDays("day", "2026-11-14")).toEqual(["2026-11-14"]);
  });
  it("la semana va de lunes a domingo, también desde un domingo", () => {
    const week = ["2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14", "2026-11-15"];
    expect(calendarDays("week", "2026-11-14")).toEqual(week); // sábado
    expect(calendarDays("week", "2026-11-15")).toEqual(week); // domingo
    expect(calendarDays("week", "2026-11-09")).toEqual(week); // lunes
  });
  it("anterior y siguiente mueven un día o una semana, cruzando meses y años", () => {
    expect(stepDate("day", "2026-12-31", 1)).toBe("2027-01-01");
    expect(stepDate("week", "2026-03-02", -1)).toBe("2026-02-23");
  });
});

describe("zonas horarias", () => {
  it("hoy depende de la zona", () => {
    const now = new Date("2026-11-13T23:30:00.000Z");
    expect(todayIn("Europe/Madrid", now)).toBe("2026-11-14");
    expect(todayIn("Atlantic/Canary", now)).toBe("2026-11-13");
  });
  it("la ventana va de las 00:00 del primer día al día siguiente al último, en la zona de cada sede", () => {
    expect(queryWindow(["2026-11-14"], ["Europe/Madrid"])).toEqual({
      from: "2026-11-13T23:00:00.000Z",
      to: "2026-11-14T23:00:00.000Z",
    });
    // Madrid (UTC+1) empieza antes y Canarias (UTC+0) acaba después.
    expect(queryWindow(["2026-11-09", "2026-11-15"], ["Atlantic/Canary", "Europe/Madrid"])).toEqual({
      from: "2026-11-08T23:00:00.000Z",
      to: "2026-11-16T00:00:00.000Z",
    });
    // Sin zonas (nadie en el alcance), UTC.
    expect(queryWindow(["2026-11-14"], [])).toEqual({ from: "2026-11-14T00:00:00.000Z", to: "2026-11-15T00:00:00.000Z" });
  });
  it("los días de cambio de hora duran lo que duran", () => {
    // 29 de marzo de 2026: en Madrid se pasa de UTC+1 a UTC+2 a las 02:00; el día dura 23 horas.
    expect(startOfDayIn("2026-03-29", "Europe/Madrid").toISOString()).toBe("2026-03-28T23:00:00.000Z");
    expect(startOfDayIn("2026-03-30", "Europe/Madrid").toISOString()).toBe("2026-03-29T22:00:00.000Z");
    // 25 de octubre de 2026: de UTC+2 a UTC+1; el día dura 25 horas.
    expect(startOfDayIn("2026-10-25", "Europe/Madrid").toISOString()).toBe("2026-10-24T22:00:00.000Z");
    expect(startOfDayIn("2026-10-26", "Europe/Madrid").toISOString()).toBe("2026-10-25T23:00:00.000Z");
  });
  it("cada cita cae en el día de su sede", () => {
    // 23:30 UTC: domingo 00:30 en Madrid, sábado 23:30 en Canarias.
    const late = "2026-11-14T23:30:00.000Z";
    const zones: Record<string, string> = { madrid: "Europe/Madrid", canary: "Atlantic/Canary" };
    const grouped = groupByDay(
      [appointment({ id: "m", locationId: "madrid", startsAt: late }), appointment({ id: "c", locationId: "canary", startsAt: late })],
      ["2026-11-14", "2026-11-15"],
      (id) => zones[id] ?? "UTC",
    );
    expect(grouped.get("2026-11-14")?.map((a) => a.id)).toEqual(["c"]);
    expect(grouped.get("2026-11-15")?.map((a) => a.id)).toEqual(["m"]);
    expect(localDate(late, "Europe/Madrid")).toBe("2026-11-15");
  });
  it("lo que cae fuera de los días visibles no sale, y cada día va por hora", () => {
    const grouped = groupByDay(
      [
        appointment({ id: "b", startsAt: "2026-11-14T15:00:00.000Z" }),
        appointment({ id: "a", startsAt: "2026-11-14T08:00:00.000Z" }),
        appointment({ id: "fuera", startsAt: "2026-11-16T08:00:00.000Z" }),
      ],
      ["2026-11-14"],
      () => "Europe/Madrid",
    );
    expect([...grouped.keys()]).toEqual(["2026-11-14"]);
    expect(grouped.get("2026-11-14")?.map((a) => a.id)).toEqual(["a", "b"]);
  });
  it("la hora va en la zona de la sede, con la zona si se pide", () => {
    const iso = "2026-11-14T09:00:00.000Z";
    expect(formatClock(iso, { locale: "es", timeZone: "Europe/Madrid", withZone: false })).toBe("10:00");
    expect(formatClock(iso, { locale: "es", timeZone: "Atlantic/Canary", withZone: false })).toBe("09:00");
    expect(formatClock(iso, { locale: "es", timeZone: "Europe/Madrid", withZone: true })).toMatch(/^10:00 CET$/);
  });
});

describe("calendarHref", () => {
  it("conserva el alcance y cambia la vista y la fecha", () => {
    const params = new URLSearchParams("scope=location:x&date=2026-01-01");
    expect(calendarHref("/app/calendar", params, "week", "2026-11-14")).toBe(
      "/app/calendar?scope=location%3Ax&date=2026-11-14&view=week",
    );
  });
});
