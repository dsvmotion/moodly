import { describe, expect, it } from "vitest";
import { isEventType } from "../events/catalog.ts";
import { REMINDER_OFFSETS, optedOut, reminderKey, reminderPlan, reminderRunId, reminderWorkflowId } from "./reminders.ts";

const HOUR = 3_600_000;
const T = Date.parse("2030-06-03T09:00:00+02:00");

describe("cuándo sale cada recordatorio (producto, 2026-11-08)", () => {
  it("reservada con más de 24 h: a las 24 h y a las 4 h", () => {
    expect(reminderPlan(T, T - 72 * HOUR)).toEqual([
      { kind: "24h", at: T - 24 * HOUR },
      { kind: "4h", at: T - 4 * HOUR },
    ]);
  });

  it("justo a 24 h: el de 24 h sale ya", () => {
    expect(reminderPlan(T, T - 24 * HOUR)).toEqual([
      { kind: "24h", at: T - 24 * HOUR },
      { kind: "4h", at: T - 4 * HOUR },
    ]);
  });

  it("con menos de 24 h y más de 4 h: el de 24 h sale al reservar, y el de 4 h a su hora", () => {
    const now = T - 10 * HOUR;
    expect(reminderPlan(T, now)).toEqual([
      { kind: "24h", at: now },
      { kind: "4h", at: T - 4 * HOUR },
    ]);
  });

  it("a 4 h justas: solo el de 4 h, ya", () => {
    expect(reminderPlan(T, T - 4 * HOUR)).toEqual([{ kind: "4h", at: T - 4 * HOUR }]);
  });

  it("con menos de 4 h, o ya pasada: ninguno", () => {
    expect(reminderPlan(T, T - 3 * HOUR)).toEqual([]);
    expect(reminderPlan(T, T + HOUR)).toEqual([]);
  });

  it("son 24 h y 4 h", () => {
    expect(REMINDER_OFFSETS).toEqual({ "24h": 24 * HOUR, "4h": 4 * HOUR });
  });

  it("los tests pueden acortarlos", () => {
    expect(reminderPlan(T, T - 30_000, { "24h": 20_000, "4h": 8_000 })).toEqual([
      { kind: "24h", at: T - 20_000 },
      { kind: "4h", at: T - 8_000 },
    ]);
    expect(reminderPlan(T, T - 10_000, { "24h": 20_000, "4h": 8_000 })).toEqual([{ kind: "24h", at: T - 10_000 }, { kind: "4h", at: T - 8_000 }]);
  });
});

describe("ids y claves", () => {
  it("el workflow de una cita a una hora es el mismo, venga la hora como venga", () => {
    const id = "c4000000-0000-4000-8000-000000000001";
    expect(reminderWorkflowId(id, "2030-06-03T09:00:00+02:00")).toBe(`reminders:${id}:2030-06-03T07:00:00.000Z`);
    expect(reminderWorkflowId(id, "2030-06-03T07:00:00.123456+00:00")).toBe(`reminders:${id}:2030-06-03T07:00:00.123Z`);
    expect(reminderWorkflowId(id, "2030-06-03T09:00:00+02:00")).not.toBe(reminderWorkflowId(id, "2030-06-03T10:00:00+02:00"));
  });

  it("la clave y el run de cada recordatorio, estables y distintos entre sí", () => {
    const id = "c4000000-0000-4000-8000-000000000001";
    const first = reminderKey(id, "2030-06-03T09:00:00+02:00", "24h");
    const second = reminderKey(id, "2030-06-03T09:00:00+02:00", "4h");
    expect(first).toBe(`reminder:${id}:2030-06-03T07:00:00.000Z:24h`);
    expect(first.length).toBeLessThanOrEqual(200);
    expect(reminderRunId(first)).toBe(reminderRunId(first));
    expect(reminderRunId(first)).not.toBe(reminderRunId(second));
    expect(reminderRunId(first)).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});

describe("la baja de los recordatorios", () => {
  it("cuenta solo si está registrada con su fecha", () => {
    expect(optedOut({ appointment_reminders: { opted_out_at: "2030-06-01T10:00:00Z" } })).toBe(true);
    expect(optedOut({})).toBe(false);
    expect(optedOut(null)).toBe(false);
    expect(optedOut({ appointment_reminders: true })).toBe(false);
    expect(optedOut({ appointment_reminders: { opted_out_at: null } })).toBe(false);
    expect(optedOut({ whatsapp: { opted_out_at: "2030-06-01T10:00:00Z" } })).toBe(false);
  });
});

describe("el consumidor", () => {
  it("se suscribe a tipos del catálogo", () => {
    expect(isEventType("appointment.created")).toBe(true);
    expect(isEventType("appointment.rescheduled")).toBe(true);
  });
});
