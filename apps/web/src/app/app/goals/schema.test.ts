import { describe, expect, it } from "vitest";
import { createGoalSchema, updateGoalSchema } from "./schema";

// Formas de entrada de la pantalla de objetivos (OA19). Los límites son los de
// los CHECK de goals: título de 1 a 200, fecha límite solo (y siempre) con el
// periodo «una vez».

const REGION = "5eed0001-0000-4000-8000-0000000000a1";
const base = {
  target: `region:${REGION}`,
  title: "  Citas de la región  ",
  metricKey: "appointments.booked",
  direction: "at_least",
  targetValue: "40",
  period: "month",
  dueDate: "",
};

describe("createGoalSchema", () => {
  it("lee un objetivo recurrente: sin fecha límite, con el título recortado", () => {
    expect(createGoalSchema.parse(base)).toEqual({
      target: { scope: "region", scopeId: REGION },
      title: "Citas de la región",
      metricKey: "appointments.booked",
      direction: "at_least",
      targetValue: 40,
      period: "month",
      dueDate: null,
    });
  });

  it("acepta la coma decimal", () => {
    expect(createGoalSchema.parse({ ...base, targetValue: "12,5" }).targetValue).toBe(12.5);
  });

  it("un objetivo de una vez necesita su fecha límite", () => {
    expect(createGoalSchema.safeParse({ ...base, period: "once" }).success).toBe(false);
    expect(createGoalSchema.parse({ ...base, period: "once", dueDate: "2026-12-31" }).dueDate).toBe("2026-12-31");
  });

  it("con un periodo recurrente, la fecha límite que llegue se descarta", () => {
    expect(createGoalSchema.parse({ ...base, dueDate: "2026-12-31" }).dueDate).toBeNull();
  });

  it.each([
    ["sin alcance", { target: "" }],
    ["un alcance que no lo es", { target: "planeta:1" }],
    ["sin título", { title: "   " }],
    ["un título de más de 200", { title: "x".repeat(201) }],
    ["una métrica fuera del catálogo", { metricKey: "custom.metric" }],
    ["un sentido desconocido", { direction: "exactly" }],
    ["un valor que no es un número", { targetValue: "cuarenta" }],
    ["un valor vacío", { targetValue: "" }],
    ["un valor negativo", { targetValue: "-1" }],
    ["un periodo desconocido", { period: "day" }],
    ["una fecha que no lo es", { period: "once", dueDate: "31/12/2026" }],
  ])("rechaza %s", (_label, change) => {
    expect(createGoalSchema.safeParse({ ...base, ...change }).success).toBe(false);
  });

  it("un porcentaje no pasa de 100", () => {
    const percent = { ...base, metricKey: "conversations.resolved_autonomously" };
    expect(createGoalSchema.parse({ ...percent, targetValue: "100" }).targetValue).toBe(100);
    expect(createGoalSchema.safeParse({ ...percent, targetValue: "101" }).success).toBe(false);
  });
});

describe("updateGoalSchema", () => {
  const update = { ...base, target: undefined, id: "5eed0009-0000-4000-8000-000000000001", status: "paused" };

  it("lee el cambio con su estado; el alcance no cambia (se crea otro objetivo)", () => {
    expect(updateGoalSchema.parse(update)).toEqual({
      id: "5eed0009-0000-4000-8000-000000000001",
      title: "Citas de la región",
      metricKey: "appointments.booked",
      direction: "at_least",
      targetValue: 40,
      period: "month",
      dueDate: null,
      status: "paused",
    });
    expect(updateGoalSchema.parse({ ...update, target: `region:${REGION}` })).not.toHaveProperty("target");
  });

  it("deja pasar una métrica fuera del catálogo con la forma de metric_key (la acción comprueba que es la que ya tenía)", () => {
    expect(updateGoalSchema.parse({ ...update, metricKey: "custom.metric" }).metricKey).toBe("custom.metric");
  });

  it.each([{ status: "deleted" }, { id: "no-es-un-uuid" }, { metricKey: "Custom Metric" }, { metricKey: "" }])("rechaza %j", (change) => {
    expect(updateGoalSchema.safeParse({ ...update, ...change }).success).toBe(false);
  });
});
