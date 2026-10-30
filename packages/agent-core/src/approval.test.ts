import { describe, expect, it } from "vitest";
import { verifyApproval } from "./approval.js";
import type { ApprovalRecord, ExecutionRecord } from "./approval.js";
import { executionHash } from "./policy.js";

const execution: ExecutionRecord = {
  id: "e1",
  run_id: "r1",
  organization_id: "o1",
  location_id: "l1",
  skill_key: "apply_discount",
  skill_version: 2,
  input: { percent: 10 },
  target: { kind: "none" },
  input_hash: executionHash({
    organizationId: "o1",
    locationId: "l1",
    runId: "r1",
    skillKey: "apply_discount",
    skillVersion: 2,
    input: { percent: 10 },
    target: { kind: "none" },
  }),
};

const approval: ApprovalRecord = {
  execution_id: "e1",
  organization_id: "o1",
  location_id: "l1",
  input_hash: execution.input_hash,
  status: "approved",
  expires_at: "2026-10-31T12:00:00.000Z",
  decided_at: "2026-10-30T12:00:00.000Z",
};

describe("verifyApproval", () => {
  it("da ok si lo aprobado es exactamente lo que se va a ejecutar", () => {
    expect(verifyApproval(execution, approval)).toEqual({ ok: true });
  });

  it("no depende del orden de las claves que devuelva la base de datos", () => {
    expect(verifyApproval({ ...execution, input: { percent: 10 } }, approval)).toEqual({ ok: true });
  });

  it.each([
    ["la entrada", { input: { percent: 100 } }],
    ["el destino", { target: { kind: "conversation", conversationId: "c", contactId: "x" } }],
    ["la versión de la skill", { skill_version: 3 }],
    ["la skill", { skill_key: "refund" }],
    ["el run", { run_id: "r2" }],
  ] as const)("rechaza si cambió %s respecto al hash guardado", (_name, change) => {
    expect(verifyApproval({ ...execution, ...change }, approval)).toEqual({ ok: false, reason: "hash_mismatch" });
  });

  it("rechaza si la aprobación lleva otro hash", () => {
    expect(verifyApproval(execution, { ...approval, input_hash: "0".repeat(64) })).toEqual({ ok: false, reason: "hash_mismatch" });
  });

  it("rechaza si la ejecución guarda un hash que no es el de su contenido", () => {
    const wrong = "f".repeat(64);
    expect(verifyApproval({ ...execution, input_hash: wrong }, { ...approval, input_hash: wrong })).toEqual({
      ok: false,
      reason: "hash_mismatch",
    });
  });

  it.each(["pending", "rejected", "expired"])("rechaza una aprobación %s", (status) => {
    expect(verifyApproval(execution, { ...approval, status })).toEqual({ ok: false, reason: "not_approved" });
  });

  it("rechaza una aprobación sin fecha de decisión", () => {
    expect(verifyApproval(execution, { ...approval, decided_at: null })).toEqual({ ok: false, reason: "not_approved" });
  });

  it("rechaza una decisión tomada después de caducar", () => {
    expect(verifyApproval(execution, { ...approval, decided_at: "2026-10-31T12:00:00.000Z" })).toEqual({
      ok: false,
      reason: "decided_after_expiry",
    });
  });

  it.each([
    ["otra ejecución", { execution_id: "e2" }],
    ["otra organización", { organization_id: "o2" }],
    ["otro local", { location_id: null }],
  ] as const)("rechaza la aprobación de %s", (_name, change) => {
    expect(verifyApproval(execution, { ...approval, ...change })).toEqual({ ok: false, reason: "other_execution" });
  });
});
