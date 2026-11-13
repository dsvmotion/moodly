import { EFFECT_CLASSES } from "@repo/agent-core";
import { describe, expect, it } from "vitest";
import { APPROVAL_TTL_MS, AWAITING_PERSON, requiredRoleFor, settledReason } from "./approvals.ts";

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
