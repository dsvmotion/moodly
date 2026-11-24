import type { WorkflowStatusString } from "@dbos-inc/dbos-sdk";

// Qué se hace con un workflow de DBOS que no terminó bien, el mismo criterio
// para la entrada de canales (ingress/ingest.ts) y el relleno del outbox
// (events/outbox.ts).

/**
 * Los que se vuelven a intentar solos: ERROR. DBOS no reanuda un ERROR
 * (resumeWorkflow no lo toca): la entrada lo rebobina con el mismo id
 * (rewindWorkflow) y el relleno lo relanza con el id del intento siguiente.
 */
export const RESUMABLE_STATUSES: readonly WorkflowStatusString[] = ["ERROR"];
/**
 * Los que no se tocan y miran las personas: CANCELLED (lo paró alguien) y
 * MAX_RECOVERY_ATTEMPTS_EXCEEDED (el proceso cayó con él demasiadas veces:
 * reanudarlo lo volvería a tirar).
 */
export const PARKED_STATUSES: readonly WorkflowStatusString[] = ["CANCELLED", "MAX_RECOVERY_ATTEMPTS_EXCEEDED"];

export function isResumable(status: string): boolean {
  return (RESUMABLE_STATUSES as readonly string[]).includes(status);
}

export function isParked(status: string): boolean {
  return (PARKED_STATUSES as readonly string[]).includes(status);
}
