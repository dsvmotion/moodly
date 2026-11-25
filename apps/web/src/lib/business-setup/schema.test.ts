import { describe, expect, it } from "vitest";
import {
  createResourceSchema,
  createServiceSchema,
  daysFromForm,
  openingHoursSchema,
  parsePrice,
  priceInputValue,
  readOpeningHours,
  setActiveSchema,
  toOpeningHours,
  updateServiceSchema,
} from "./schema";

const LOC = "a2000000-0000-4000-8000-000000000001";
const SVC = "c0000000-0000-4000-8000-000000000001";

describe("precio", () => {
  it.each([
    ["45", 4500],
    ["45,5", 4550],
    ["45.50", 4550],
    ["0", 0],
    [" 12,05 ", 1205],
    ["100000", 10_000_000],
    ["", null],
  ])("%j → %j céntimos", (input, cents) => {
    expect(parsePrice(input)).toBe(cents);
  });

  it.each(["-1", "45,555", "1.234,50", "abc", "45€", "100000,01", "1e3"])("%j no se entiende", (input) => {
    expect(parsePrice(input)).toBeUndefined();
  });

  it("vuelve al campo como se escribió", () => {
    expect(priceInputValue(4550)).toBe("45,50");
    expect(priceInputValue(4500)).toBe("45");
    expect(priceInputValue(5)).toBe("0,05");
    expect(priceInputValue(null)).toBe("");
  });
});

describe("servicios", () => {
  const base = { name: "  Facial  ", durationMinutes: "45", price: "45,50", currency: "EUR", locationId: "" };

  it("un servicio nuevo, en todos los locales", () => {
    expect(createServiceSchema.parse(base)).toEqual({ name: "Facial", durationMinutes: 45, price: 4550, currency: "EUR", locationId: "" });
  });

  it("sin precio publicado", () => {
    expect(createServiceSchema.parse({ ...base, price: "" }).price).toBeNull();
  });

  it.each([
    ["sin nombre", { name: "   " }],
    ["nombre largo", { name: "x".repeat(121) }],
    ["duración corta", { durationMinutes: "4" }],
    ["duración larga", { durationMinutes: "601" }],
    ["duración con decimales", { durationMinutes: "30.5" }],
    ["precio raro", { price: "abc" }],
    ["moneda fuera de la lista", { currency: "JPY" }],
    ["local que no es un id", { locationId: "x" }],
  ])("%s: no", (_label, change) => {
    expect(createServiceSchema.safeParse({ ...base, ...change }).success).toBe(false);
  });

  it("cambiar uno pide su id y no deja cambiar el local", () => {
    expect(updateServiceSchema.safeParse({ ...base, id: "x" }).success).toBe(false);
    expect(updateServiceSchema.parse({ ...base, id: SVC })).not.toHaveProperty("locationId");
  });

  it("activar y desactivar", () => {
    expect(setActiveSchema.parse({ id: SVC, active: "false" })).toEqual({ id: SVC, active: false });
    expect(setActiveSchema.safeParse({ id: SVC, active: "maybe" }).success).toBe(false);
  });
});

describe("recursos", () => {
  it("con su local y sin servicios repetidos", () => {
    expect(createResourceSchema.parse({ name: "Marta", kind: "staff", locationId: LOC, serviceIds: [SVC, SVC] })).toEqual({
      name: "Marta",
      kind: "staff",
      locationId: LOC,
      serviceIds: [SVC],
    });
  });

  it("un tipo que no existe o sin local, no", () => {
    expect(createResourceSchema.safeParse({ name: "Marta", kind: "robot", locationId: LOC, serviceIds: [] }).success).toBe(false);
    expect(createResourceSchema.safeParse({ name: "Marta", kind: "staff", locationId: "", serviceIds: [] }).success).toBe(false);
  });
});

describe("horario", () => {
  const form = (entries: Record<string, string>) => {
    const data = new FormData();
    for (const [key, value] of Object.entries(entries)) data.set(key, value);
    return data;
  };

  it("del formulario a opening_hours: solo los días abiertos", () => {
    const days = daysFromForm(form({ "mon.open": "on", "mon.from": "09:00", "mon.to": "14:00", "sat.open": "on", "sat.from": "10:00", "sat.to": "13:30", "tue.from": "09:00" }));
    const parsed = openingHoursSchema.parse({ locationId: LOC, days });
    expect(toOpeningHours(parsed.days)).toEqual({ mon: ["09:00", "14:00"], sat: ["10:00", "13:30"] });
  });

  it("todo cerrado: un horario vacío", () => {
    const parsed = openingHoursSchema.parse({ locationId: LOC, days: daysFromForm(form({})) });
    expect(toOpeningHours(parsed.days)).toEqual({});
  });

  it.each([
    ["cerrar antes de abrir", { "mon.open": "on", "mon.from": "14:00", "mon.to": "09:00" }],
    ["a la vez", { "mon.open": "on", "mon.from": "09:00", "mon.to": "09:00" }],
    ["una hora sin forma", { "mon.open": "on", "mon.from": "9:00", "mon.to": "14:00" }],
    ["abierto sin horas", { "mon.open": "on" }],
  ])("%s: no", (_label, entries) => {
    expect(openingHoursSchema.safeParse({ locationId: LOC, days: daysFromForm(form(entries)) }).success).toBe(false);
  });

  it("lo guardado vuelve al formulario; lo que no tiene forma, cerrado", () => {
    const days = readOpeningHours({ mon: ["09:00", "14:00"], tue: "9-14", x: 1 });
    expect(days.mon).toEqual({ open: true, from: "09:00", to: "14:00" });
    expect(days.tue.open).toBe(false);
    expect(readOpeningHours(null).sun.open).toBe(false);
  });
});
