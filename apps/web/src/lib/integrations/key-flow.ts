import {
  isAcceptableSubmittedKey,
  sealSubmission,
  type IngressPublicKey,
  type SealedSubmission,
} from "@repo/integrations/key-ingress";

// El alta de la clave de una integración nativa, sin Next.js ni Supabase
// (ADR 0055; int-koibox). La Server Action le da el acceso a las filas con el
// cliente de la persona (RLS y las guardas mandan) y la parte pública de la
// clave de ingreso. Así se prueba sola.
//
// - La clave del cliente solo existe aquí en memoria: se comprueba su forma, se
//   cifra hacia el worker y se inserta el sobre. Nunca va a un log, a un
//   error ni de vuelta al navegador.
// - La organización y el proveedor los pone el servidor; el id del envío
//   también (va en el dato asociado del cifrado).
// - La barrera es la base de datos: RLS (org_admin con aal2), las listas
//   blancas y el freno de 5 envíos en 15 minutos (20261124100000, SQLSTATE 54000).

export interface KeyIntegrationRow {
  id: string;
  status: string;
}

export type InsertSubmissionResult = "ok" | "too_many" | "not_allowed";

/** El acceso a la integración nativa de esta organización y este proveedor. */
export interface KeyIntegrationStore {
  find(): Promise<KeyIntegrationRow | null>;
  /** Crea la fila pendiente; su id, o null si RLS no deja. */
  insertPending(): Promise<string | null>;
  /** Vuelve a pendiente una desconectada (reconectar). false si no la alcanza. */
  setPending(id: string): Promise<boolean>;
  /** Inserta el envío cifrado, sin leerlo de vuelta (la app no tiene SELECT). */
  insertSubmission(row: { id: string; integrationId: string; sealed: SealedSubmission }): Promise<InsertSubmissionResult>;
  /** La pasa a desconectada. false si no cambió ninguna fila. */
  markDisconnected(id: string): Promise<boolean>;
}

export type SubmitKeyError = "invalid_key" | "not_allowed" | "too_many";

export type SubmitKeyOutcome =
  | { ok: true; integrationId: string; submissionId: string }
  | { ok: false; error: SubmitKeyError; integrationId?: string };

/** Los estados en los que la integración admite una clave nueva (guard_secret_submission). */
const ACCEPTS_KEY = new Set(["pending", "active", "error"]);

export async function submitKeyFlow(
  store: KeyIntegrationStore,
  publicKey: IngressPublicKey,
  context: { organizationId: string; provider: string; submissionId: string },
  submittedKey: string,
): Promise<SubmitKeyOutcome> {
  // Antes de tocar nada: una clave con mala forma no crea ni cambia filas.
  if (!isAcceptableSubmittedKey(submittedKey)) return { ok: false, error: "invalid_key" };

  const existing = await store.find();
  let integrationId: string;
  if (!existing) {
    const created = await store.insertPending();
    if (!created) return { ok: false, error: "not_allowed" };
    integrationId = created;
  } else if (existing.status === "disconnected") {
    if (!(await store.setPending(existing.id))) return { ok: false, error: "not_allowed", integrationId: existing.id };
    integrationId = existing.id;
  } else if (ACCEPTS_KEY.has(existing.status)) {
    integrationId = existing.id;
  } else {
    return { ok: false, error: "not_allowed", integrationId: existing.id };
  }

  const sealed = sealSubmission(
    publicKey,
    { organizationId: context.organizationId, integrationId, submissionId: context.submissionId, provider: context.provider },
    submittedKey,
  );
  const inserted = await store.insertSubmission({ id: context.submissionId, integrationId, sealed });
  if (inserted !== "ok") return { ok: false, error: inserted, integrationId };
  return { ok: true, integrationId, submissionId: context.submissionId };
}

export type KeySubmissionResult = "checking" | "applied" | "rejected";

/**
 * Qué pasó con un envío, según la marca de la integración: el worker la mueve
 * al procesarlo, con su resultado (20261124100000). Mientras no apunte a este
 * envío, se sigue comprobando.
 */
export function submissionResult(
  row: { last_submission_id: string | null; last_submission_result: string | null } | null,
  submissionId: string,
): KeySubmissionResult {
  if (!row || row.last_submission_id !== submissionId) return "checking";
  return row.last_submission_result === "applied" ? "applied" : row.last_submission_result === "rejected" ? "rejected" : "checking";
}

/** SQLSTATE de la base de datos → error para la persona. */
export function insertErrorFor(code: string | undefined): InsertSubmissionResult {
  return code === "54000" ? "too_many" : "not_allowed";
}
