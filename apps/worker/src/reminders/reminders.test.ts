import { describe, expect, it } from "vitest";
import { isEventType } from "../events/catalog.ts";
import {
  REMINDER_RULES,
  localMinutes,
  optedOut,
  outOfQuietHours,
  reminderKey,
  reminderPlan,
  reminderRunId,
  reminderWorkflowId,
} from "./reminders.ts";

const HOUR = 3_600_000;
const MADRID = "Europe/Madrid";
// Una cita a las 20:00 de Madrid (verano, UTC+2): ninguno de sus recordatorios cae de noche.
const T = Date.parse("2030-06-03T20:00:00+02:00");
const at = (iso: string) => Date.parse(iso);

describe("cuándo sale cada recordatorio (producto, 2026-11-08)", () => {
  it("reservada con más de 24 h: a las 24 h y a las 4 h", () => {
    expect(reminderPlan(T, T - 72 * HOUR, MADRID)).toEqual({
      reminders: [
        { kind: "24h", at: T - 24 * HOUR },
        { kind: "4h", at: T - 4 * HOUR },
      ],
      dropped: [],
    });
  });

  it("justo a 24 h: el de 24 h sale ya", () => {
    expect(reminderPlan(T, T - 24 * HOUR, MADRID).reminders).toEqual([
      { kind: "24h", at: T - 24 * HOUR },
      { kind: "4h", at: T - 4 * HOUR },
    ]);
  });

  it("con menos de 24 h y más de 4 h: el de 24 h sale al reservar, y el de 4 h a su hora", () => {
    const now = T - 10 * HOUR;
    expect(reminderPlan(T, now, MADRID).reminders).toEqual([
      { kind: "24h", at: now },
      { kind: "4h", at: T - 4 * HOUR },
    ]);
  });

  it("a 4 h justas: solo el de 4 h, ya", () => {
    expect(reminderPlan(T, T - 4 * HOUR, MADRID).reminders).toEqual([{ kind: "4h", at: T - 4 * HOUR }]);
  });

  it("con menos de 4 h, o ya pasada: ninguno", () => {
    expect(reminderPlan(T, T - 3 * HOUR, MADRID)).toEqual({ reminders: [], dropped: [] });
    expect(reminderPlan(T, T + HOUR, MADRID)).toEqual({ reminders: [], dropped: [] });
  });

  it("son 24 h y 4 h, nunca de 22:00 a 07:00 y al menos 1 h entre los dos", () => {
    expect(REMINDER_RULES).toEqual({
      offsets: { "24h": 24 * HOUR, "4h": 4 * HOUR },
      quietHours: { startMinute: 22 * 60, endMinute: 7 * 60 },
      minGapMs: HOUR,
    });
  });
});

describe("al menos 1 h entre los dos: si no, solo sale el primero", () => {
  it("reservada 4 h y 5 min antes: sale el del momento de reservar y no el de 4 h", () => {
    const now = T - 4 * HOUR - 5 * 60_000;
    expect(reminderPlan(T, now, MADRID)).toEqual({ reminders: [{ kind: "24h", at: now }], dropped: [{ kind: "4h", reason: "gap" }] });
  });

  it("a 59 minutos, tampoco; a 1 h justa, los dos", () => {
    expect(reminderPlan(T, T - 4 * HOUR - 59 * 60_000, MADRID).reminders.map((r) => r.kind)).toEqual(["24h"]);
    expect(reminderPlan(T, T - 5 * HOUR, MADRID).reminders.map((r) => r.kind)).toEqual(["24h", "4h"]);
  });
});

describe("nunca de 22:00 a 07:00 del local", () => {
  it("una cita a las 09:00: el de 4 h caería a las 05:00 y sale a las 07:00", () => {
    const nine = at("2030-06-03T09:00:00+02:00");
    expect(reminderPlan(nine, nine - 72 * HOUR, MADRID).reminders).toEqual([
      { kind: "24h", at: nine - 24 * HOUR },
      { kind: "4h", at: at("2030-06-03T07:00:00+02:00") },
    ]);
  });

  it("si a las 07:00 la cita ya ha empezado, no sale (y el del día antes, a las 06:30, también espera a las 07:00)", () => {
    const early = at("2030-06-03T06:30:00+02:00");
    expect(reminderPlan(early, early - 72 * HOUR, MADRID)).toEqual({
      reminders: [{ kind: "24h", at: at("2030-06-02T07:00:00+02:00") }],
      dropped: [{ kind: "4h", reason: "quiet_hours" }],
    });
  });

  it("reservada a las 23:30 para mañana a las 10:00: uno solo, a las 07:00", () => {
    const ten = at("2030-06-04T10:00:00+02:00");
    const now = at("2030-06-03T23:30:00+02:00");
    expect(reminderPlan(ten, now, MADRID)).toEqual({
      reminders: [{ kind: "24h", at: at("2030-06-04T07:00:00+02:00") }],
      dropped: [{ kind: "4h", reason: "gap" }],
    });
  });

  it("las 22:00 ya son de noche; las 07:00, no", () => {
    expect(outOfQuietHours(at("2030-06-03T22:00:00+02:00"), MADRID)).toBe(at("2030-06-04T07:00:00+02:00"));
    expect(outOfQuietHours(at("2030-06-03T21:59:00+02:00"), MADRID)).toBe(at("2030-06-03T21:59:00+02:00"));
    expect(outOfQuietHours(at("2030-06-03T07:00:00+02:00"), MADRID)).toBe(at("2030-06-03T07:00:00+02:00"));
    expect(outOfQuietHours(at("2030-06-03T06:59:30+02:00"), MADRID)).toBe(at("2030-06-03T07:00:00+02:00"));
  });

  it("en la hora del local, no en la del servidor", () => {
    // Las 05:00 en Madrid son las 04:00 en Canarias: las dos de noche, y cada una sale a las 07:00 de su local.
    expect(outOfQuietHours(at("2030-06-03T03:00:00Z"), "Atlantic/Canary")).toBe(at("2030-06-03T06:00:00Z"));
    expect(outOfQuietHours(at("2030-06-03T03:00:00Z"), MADRID)).toBe(at("2030-06-03T05:00:00Z"));
    // A esa misma hora en Nueva York son las 23:00 del día anterior.
    expect(localMinutes(outOfQuietHours(at("2030-06-03T03:00:00Z"), "America/New_York"), "America/New_York")).toBe(7 * 60);
  });

  it("también la noche que cambia la hora (horario de verano)", () => {
    // 31 de marzo de 2030: en Madrid, a las 02:00 pasan a ser las 03:00. La 01:30 sale a las 07:00 del verano.
    expect(outOfQuietHours(at("2030-03-31T00:30:00Z"), MADRID)).toBe(at("2030-03-31T07:00:00+02:00"));
    // 27 de octubre de 2030: a las 03:00 vuelven a ser las 02:00. La 01:30 sale a las 07:00 del invierno.
    expect(outOfQuietHours(at("2030-10-26T23:30:00Z"), MADRID)).toBe(at("2030-10-27T07:00:00+01:00"));
  });

  it("los tests pueden acortarlos y quitar la separación", () => {
    const rules = { ...REMINDER_RULES, offsets: { "24h": 20_000, "4h": 8_000 }, minGapMs: 0 };
    expect(reminderPlan(T, T - 30_000, MADRID, rules).reminders).toEqual([
      { kind: "24h", at: T - 20_000 },
      { kind: "4h", at: T - 8_000 },
    ]);
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
