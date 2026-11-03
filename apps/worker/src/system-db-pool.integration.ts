import pg from "pg";
import { afterAll, describe, expect, it } from "vitest";
import { createLogger } from "./logger.ts";
import { createSystemDatabasePool, IDLE_IN_TRANSACTION_TIMEOUT_MS, SYSTEM_DATABASE_POOL_SIZE } from "./system-db-pool.ts";
import { localSystemDatabaseUrl } from "./testing/local-system-db.ts";

// El pool de la base de datos de sistema de DBOS (system-db-pool.ts) contra
// Supabase local, con el rol sin DDL del worker.
const pool = createSystemDatabasePool({
  connectionString: localSystemDatabaseUrl(),
  applicationName: "dbos_transact_test-pool_test",
  logger: createLogger("error"),
});
afterAll(() => pool.end());

describe("pool de la base de datos de sistema", () => {
  it("cada conexión nueva sale con el timeout de DBOS para transacciones inactivas y su application_name", async () => {
    // Varias conexiones nuevas a la vez: ninguna se entrega sin el SET.
    const results = await Promise.all(
      Array.from({ length: 3 }, () =>
        pool.query<{ timeout: string; app: string }>(
          "select current_setting('idle_in_transaction_session_timeout') as timeout, current_setting('application_name') as app",
        ),
      ),
    );
    for (const { rows } of results) {
      expect(rows[0]).toEqual({ timeout: `${IDLE_IN_TRANSACTION_TIMEOUT_MS / 60_000}min`, app: "dbos_transact_test-pool_test" });
    }
    expect(pool.options.max).toBe(SYSTEM_DATABASE_POOL_SIZE);
  });

  it("la primera consulta en una conexión nueva no se encola detrás del SET (pg 9 no lo admitirá)", async () => {
    // Lo que hace DBOS: pool.query() en un pool sin conexiones libres, así que
    // la consulta sale en el mismo tic en que pg-pool entrega una conexión
    // nueva. Con el SET lanzado desde el evento `connect` (el pool propio de
    // DBOS 5.3.0), el SET aún está en la cola y la consulta se encola detrás.
    // Se mira la condición exacta del aviso de pg 8 (client.js): llamar a
    // query() con otra consulta ya en la cola del cliente.
    const fresh = createSystemDatabasePool({
      connectionString: localSystemDatabaseUrl(),
      applicationName: "dbos_transact_test-pool_test",
      logger: createLogger("error"),
    });
    const queued: string[] = [];
    const query = pg.Client.prototype.query;
    pg.Client.prototype.query = function (this: { _queryQueue: unknown[] }, ...args: unknown[]) {
      const [config] = args;
      if (this._queryQueue.length > 0) queued.push(typeof config === "string" ? config : String((config as { text?: unknown })?.text));
      return (query as (...a: unknown[]) => unknown).apply(this, args);
    } as typeof query;
    try {
      await Promise.all([fresh.query("select 1"), fresh.query("select 2"), fresh.query("select 3")]);
    } finally {
      pg.Client.prototype.query = query;
      await fresh.end();
    }
    expect(queued).toEqual([]);
  });

  it("un error en una conexión libre no tumba el proceso", async () => {
    const client = await pool.connect();
    client.release();
    // Sin manejador de 'error' en el pool, esto lanzaría y el proceso caería.
    expect(() => client.emit("error", new Error("conexión cortada"))).not.toThrow();
  });
});
