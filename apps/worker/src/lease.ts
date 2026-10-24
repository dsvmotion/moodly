import pg from "pg";
import type { Logger } from "pino";

// Un solo proceso vivo por executorID (ADR 0027, regla 1). Antes de arrancar
// DBOS, el worker toma un advisory lock de sesión con la clave de su executorID
// y lo mantiene hasta pararse. Si un despliegue arranca el contenedor nuevo
// mientras el viejo sigue vivo, el nuevo espera aquí a que el viejo termine: su
// conexión se cierra al salir (también con SIGKILL) y Postgres suelta el lock.
//
// El lock vive en una conexión propia, fuera del pool de DBOS. Si esa conexión
// se pierde, el lock ya no protege nada: onLost avisa para que el proceso se
// pare en vez de seguir ejecutando pasos que otro podría estar repitiendo.

export interface ExecutorLease {
  /** Suelta el lock y cierra su conexión. Llamar después de parar DBOS. */
  release(): Promise<void>;
}

export interface LeaseOptions {
  connectionString: string;
  executorId: string;
  logger: Logger;
  /** Se llama una vez si la conexión del lock se cae con el proceso aún en marcha. */
  onLost: (err: Error) => void;
  /** Para dejar de esperar (SIGTERM durante la espera). */
  signal?: AbortSignal;
  /** Cada cuánto se reintenta mientras otro proceso tiene el lock. */
  retryMs?: number;
  /** Cada cuánto se avisa en el log de que se sigue esperando. */
  waitLogMs?: number;
}

export class LeaseAbortedError extends Error {
  override name = "LeaseAbortedError";
}

/** Clave del lock: estable, distinta por executorID y propia del worker. */
export function leaseKey(executorId: string): string {
  return `moodly-worker:executor:${executorId}`;
}

// hashtextextended devuelve un bigint: un solo espacio de claves, sin chocar
// con locks de dos enteros de otras piezas.
const TRY_LOCK = "select pg_try_advisory_lock(hashtextextended($1, 0)) as locked";
const UNLOCK = "select pg_advisory_unlock(hashtextextended($1, 0))";

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new LeaseAbortedError("espera cancelada"));
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new LeaseAbortedError("espera cancelada"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export async function acquireExecutorLease(options: LeaseOptions): Promise<ExecutorLease> {
  const { executorId, logger, signal } = options;
  const retryMs = options.retryMs ?? 2_000;
  const waitLogMs = options.waitLogMs ?? 30_000;
  const key = leaseKey(executorId);

  // keepAlive: si la red se corta sin cerrar el socket, la caída se nota y
  // onLost se dispara en lugar de quedarse con un lock que ya no existe.
  const client = new pg.Client({ connectionString: options.connectionString, keepAlive: true });
  let held = false;
  let released = false;
  client.on("error", (err) => {
    if (held && !released) {
      released = true;
      options.onLost(err);
    }
  });
  client.on("end", () => {
    if (held && !released) {
      released = true;
      options.onLost(new Error("se cerró la conexión del lock del executor"));
    }
  });

  await client.connect();
  try {
    const startedAt = Date.now();
    let lastLog = 0;
    for (;;) {
      const { rows } = await client.query<{ locked: boolean }>(TRY_LOCK, [key]);
      if (rows[0]?.locked) break;
      const waited = Date.now() - startedAt;
      if (lastLog === 0 || waited - lastLog >= waitLogMs) {
        logger.warn({ executorId, waitedMs: waited }, "otro proceso tiene este executorID; espero a que pare");
        lastLog = waited || 1;
      }
      await sleep(retryMs, signal);
    }
    held = true;
    logger.info({ executorId, waitedMs: Date.now() - startedAt }, "lock del executor tomado");
  } catch (err) {
    await client.end().catch(() => {});
    throw err;
  }

  return {
    async release() {
      if (released) return;
      released = true;
      try {
        await client.query(UNLOCK, [key]);
      } finally {
        await client.end();
      }
    },
  };
}
