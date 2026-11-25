import { KEY_SUBMISSION_TTL_MS } from "@repo/config";

// Lo que la tarjeta de una integración con clave del cliente dice de un envío
// (ADR 0055). Sin cifrado ni nada de servidor: lo importa el componente del
// cliente.

export type KeySubmissionResult = "checking" | "applied" | "rejected";
export type KeyCheckState = KeySubmissionResult | "timed_out";

/** Margen sobre la caducidad: el último intento del worker puede tardar un poco. */
export const CHECK_GRACE_MS = 60_000;

/**
 * Si pasada la caducidad (más un margen) la marca sigue sin llegar al envío que
 * la web hizo en `sentAtMs`, el worker ya no lo aplicará (caducó o no se pudo
 * abrir): «no se pudo comprobar a tiempo». Sin columna nueva: la web sabe cuándo
 * lo envió.
 */
export function keyCheckState(
  result: KeySubmissionResult,
  sentAtMs: number,
  nowMs: number,
  ttlMs: number = KEY_SUBMISSION_TTL_MS,
): KeyCheckState {
  if (result !== "checking") return result;
  return nowMs - sentAtMs > ttlMs + CHECK_GRACE_MS ? "timed_out" : "checking";
}
