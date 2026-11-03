import pg from "pg";
import type { Logger } from "pino";

// Pool de la base de datos de sistema de DBOS. Lo crea el worker, no DBOS, por
// un fallo de DBOS 5.3.0 (igual en 5.4.0 y en 5.5.5-preview): su pool propio
// lanza `SET idle_in_transaction_session_timeout` desde el evento `connect` de
// pg-pool, que llega antes de que la conexión esté lista para consultas. El SET
// se queda en la cola del cliente y la primera consulta de quien pidió la
// conexión se encola detrás: pg 8 avisa («Calling client.query() when the client
// is already executing a query», DeprecationWarning) y pg 9 lo quitará, así que
// el worker no arrancaría.
//
// Aquí el SET va en `onConnect`, que pg-pool espera antes de entregar la
// conexión: cuando DBOS la recibe, el cliente está libre. Si el SET falla, la
// conexión no se entrega (DBOS solo avisaba y seguía sin el timeout).
//
// Lo demás, como el pool de DBOS (SystemDatabase en system_database.js): mismo
// tamaño, timeout de conexión y application_name, y un manejador de 'error'
// para las conexiones libres (sin él, el error de una tumbaría el proceso).
// DBOS no cierra un pool que no es suyo: lo cierra quien lo crea, después de
// parar DBOS.

/** El timeout de DBOS para transacciones inactivas (DEFAULT_IDLE_TRANSACTION_TIMEOUT_MS). */
export const IDLE_IN_TRANSACTION_TIMEOUT_MS = 60_000;
/** El tamaño del pool de DBOS (DEFAULT_POOL_SIZE). */
export const SYSTEM_DATABASE_POOL_SIZE = 10;
/** El de DBOS si la URL no lleva `connect_timeout` (getClientConfig). */
const DEFAULT_CONNECT_TIMEOUT_MS = 10_000;

export interface SystemDatabasePoolOptions {
  connectionString: string;
  /** Sale en pg_stat_activity. El worker usa el de DBOS: dbos_transact_<executorID>_<versión>. */
  applicationName: string;
  logger: Logger;
}

function connectTimeoutMs(connectionString: string): number {
  const seconds = Number.parseInt(new URL(connectionString).searchParams.get("connect_timeout") ?? "", 10);
  return Number.isFinite(seconds) ? seconds * 1000 : DEFAULT_CONNECT_TIMEOUT_MS;
}

export function createSystemDatabasePool(options: SystemDatabasePoolOptions): pg.Pool {
  const pool = new pg.Pool({
    connectionString: options.connectionString,
    connectionTimeoutMillis: connectTimeoutMs(options.connectionString),
    application_name: options.applicationName,
    max: SYSTEM_DATABASE_POOL_SIZE,
    // Fuera de toda transacción: vale para toda la sesión.
    onConnect: async (client) => {
      await client.query(`SET idle_in_transaction_session_timeout = ${IDLE_IN_TRANSACTION_TIMEOUT_MS}`);
    },
  });
  // Solo el mensaje y el código: pg-pool cuelga del error el cliente entero
  // (err.client), que no debe acabar serializado en un log.
  pool.on("error", (err) => {
    const code = (err as { code?: unknown }).code;
    options.logger.warn(
      { reason: err.message, ...(typeof code === "string" ? { code } : {}) },
      "error en una conexión libre de la base de datos de sistema",
    );
  });
  return pool;
}
