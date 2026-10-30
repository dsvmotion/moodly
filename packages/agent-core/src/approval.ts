import { executionHash } from "./policy.js";
import type { Target } from "./skill.js";

// Antes de ejecutar algo aprobado (ADR 0047 §3, control 3.3): se recalcula el
// hash de lo que se va a ejecutar, tal como está guardado, y tiene que coincidir
// con el de la ejecución y con el de su aprobación. La base de datos ya impide
// cambiar la entrada, el destino y los hashes; esto cubre lo que ella no ve: un
// hash mal calculado al crear la ejecución o filas de otra ejecución mezcladas.
//
// Función pura: el worker lee las dos filas con forOrganization(org) y la llama
// justo antes de execute. Si no da ok, no se ejecuta.

/** Las columnas de public.executions que entran en la comprobación. */
export interface ExecutionRecord {
  id: string;
  run_id: string;
  organization_id: string;
  location_id: string | null;
  skill_key: string;
  skill_version: number;
  input: unknown;
  target: unknown;
  input_hash: string;
}

/** Las columnas de public.approvals que entran en la comprobación. */
export interface ApprovalRecord {
  execution_id: string;
  organization_id: string;
  location_id: string | null;
  input_hash: string;
  status: string;
  expires_at: string;
  decided_at: string | null;
}

export type ApprovalCheck =
  | { ok: true }
  | { ok: false; reason: "other_execution" | "not_approved" | "decided_after_expiry" | "hash_mismatch" };

export function verifyApproval(execution: ExecutionRecord, approval: ApprovalRecord): ApprovalCheck {
  if (
    approval.execution_id !== execution.id ||
    approval.organization_id !== execution.organization_id ||
    approval.location_id !== execution.location_id
  ) {
    return { ok: false, reason: "other_execution" };
  }
  if (approval.status !== "approved" || approval.decided_at === null) return { ok: false, reason: "not_approved" };
  if (Date.parse(approval.decided_at) >= Date.parse(approval.expires_at)) return { ok: false, reason: "decided_after_expiry" };

  const recomputed = executionHash({
    organizationId: execution.organization_id,
    locationId: execution.location_id,
    runId: execution.run_id,
    skillKey: execution.skill_key,
    skillVersion: execution.skill_version,
    input: execution.input,
    target: execution.target as Target,
  });
  if (recomputed !== execution.input_hash || approval.input_hash !== execution.input_hash) {
    return { ok: false, reason: "hash_mismatch" };
  }
  return { ok: true };
}
