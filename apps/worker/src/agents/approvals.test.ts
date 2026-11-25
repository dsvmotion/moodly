import { EFFECT_CLASSES } from "@repo/agent-core";
import { describe, expect, it } from "vitest";
import { APPROVAL_TTL_MS, AWAITING_PERSON, EDITABLE_FIELDS, approvedInput, requiredRoleFor, settledReason } from "./approvals.ts";

const LOCATION = "a2000000-0000-4000-8000-000000000001";

describe("quién decide lo que propone el agente", () => {
  it("lo de cada día lo decide el equipo del local; enviar a muchos, cobrar o borrar, quien lo dirige", () => {
    expect(Object.fromEntries(EFFECT_CLASSES.map((effect) => [effect, requiredRoleFor(effect, LOCATION)]))).toEqual({
      read: "staff",
      internal_write: "staff",
      external_message: "staff",
      external_outreach: "location_manager",
      financial: "location_manager",
      destructive: "location_manager",
    });
  });

  it("sin local, solo un org_admin (lo exige la tabla)", () => {
    for (const effect of EFFECT_CLASSES) expect(requiredRoleFor(effect, null)).toBe("org_admin");
  });

  it("espera un día, y solo lo que espera a una persona nace con aprobación", () => {
    expect(APPROVAL_TTL_MS).toBe(24 * 3_600_000);
    expect([...AWAITING_PERSON].sort()).toEqual(["drafted", "needs_approval", "suggested"]);
  });
});

describe("una aprobación que llega tarde (gate M1)", () => {
  it("si una respuesta más nueva relevó al borrador, lo dice: superseded, no un «ya estaba» mudo", () => {
    expect(settledReason("failed", { superseded: "newer_message" })).toBe("superseded");
    expect(settledReason("failed", { error: "send_failed" })).toBe("already_settled");
    expect(settledReason("failed", null)).toBe("already_settled");
    expect(settledReason("executed", { superseded: "newer_message" })).toBe("already_settled");
  });
});

describe("lo que se ejecuta al aprobar con una corrección (OA02)", () => {
  it("sin corrección, lo que propuso el agente, tal cual", () => {
    const original = { text: "Hola" };
    expect(approvedInput("reply", original, null)).toEqual({ ok: true, input: original, edited: false });
    expect(approvedInput("book_appointment", { starts_at: "x" }, undefined)).toEqual({ ok: true, input: { starts_at: "x" }, edited: false });
  });

  it("con la corrección del texto de una respuesta, la respuesta con ese texto", () => {
    expect(approvedInput("reply", { text: "Hola" }, { text: "Hola, corregido" })).toEqual({ ok: true, input: { text: "Hola, corregido" }, edited: true });
  });

  it("solo se corrige el texto de una respuesta: nada más, ni otra skill", () => {
    expect(EDITABLE_FIELDS).toEqual({ reply: ["text"] });
    expect(approvedInput("book_appointment", { starts_at: "2030-01-01T10:00:00Z" }, { starts_at: "2030-01-02T10:00:00Z" })).toEqual({
      ok: false,
      reason: "not_editable",
    });
    expect(approvedInput("reply", { text: "Hola" }, { text: "x", conversation_id: "otra" })).toEqual({ ok: false, reason: "edit_fields" });
    expect(approvedInput("reply", { text: "Hola" }, {})).toEqual({ ok: false, reason: "edit_fields" });
    expect(approvedInput("reply", { text: "Hola" }, ["x"])).toEqual({ ok: false, reason: "edit_fields" });
    expect(approvedInput("reply", { text: "Hola" }, "x")).toEqual({ ok: false, reason: "edit_fields" });
  });
});
