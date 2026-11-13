// Intentos acotados de procesar un evento de entrada (revisión de V10 de #229).
// El workflow de DBOS no se queda en ERROR: cada intento que falla se apunta, se
// espera un poco más y se vuelve a intentar; al agotarlos, el evento queda
// fallido para siempre (dead_letter) y alguien lo mira. Los pasos de cada
// intento son idempotentes, así que repetirlos no duplica nada.

export const MAX_INGEST_ATTEMPTS = 5;
/** La espera antes de cada reintento: 5 s, 30 s, 2 min y 10 min. */
export const INGEST_BACKOFF_MS: readonly number[] = [5_000, 30_000, 120_000, 600_000];
export const DEAD_LETTER = "dead_letter";

export type AttemptOutcome<T> = { ok: true; value: T; attempts: number } | { ok: false; deadLetter: true; attempts: number; lastError: string };

export interface AttemptHooks {
  /** Apunta un intento fallido (con su número y el código, o dead_letter en el último). */
  recordFailure(attempt: number, code: string): Promise<void>;
  /** Espera antes del siguiente intento (en el workflow, DBOS.sleep: duradero). */
  sleep(ms: number): Promise<void>;
}

/** El código de un error para guardarlo, sin su mensaje (puede llevar datos). */
export function errorCode(error: unknown): string {
  const code = (error as { code?: unknown } | null)?.code;
  if (typeof code === "string" && /^[\w.:-]{1,40}$/.test(code)) return code;
  const name = (error as { name?: unknown } | null)?.name;
  return typeof name === "string" && /^[\w.:-]{1,60}$/.test(name) ? name : "Error";
}

export async function runAttempts<T>(
  attempt: (n: number) => Promise<T>,
  hooks: AttemptHooks,
  max = MAX_INGEST_ATTEMPTS,
  backoff: readonly number[] = INGEST_BACKOFF_MS,
): Promise<AttemptOutcome<T>> {
  for (let n = 1; ; n += 1) {
    try {
      return { ok: true, value: await attempt(n), attempts: n };
    } catch (error) {
      const code = errorCode(error);
      if (n >= max) {
        await hooks.recordFailure(n, DEAD_LETTER);
        return { ok: false, deadLetter: true, attempts: n, lastError: code };
      }
      await hooks.recordFailure(n, code);
      await hooks.sleep(backoff[Math.min(n - 1, backoff.length - 1)] ?? 0);
    }
  }
}
