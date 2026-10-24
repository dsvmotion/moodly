import { randomUUID } from "node:crypto";
import pg from "pg";
import { afterAll, describe, expect, it } from "vitest";
import { acquireExecutorLease, LeaseAbortedError, leaseKey, type ExecutorLease } from "./lease.ts";
import { createLogger } from "./logger.ts";
import { localSystemDatabaseUrl } from "./testing/local-system-db.ts";

// El lock del executor (regla 1 del ADR 0027) contra Supabase local, con el rol
// sin DDL del worker.
const connectionString = localSystemDatabaseUrl();
const logger = createLogger("error");
const leases: ExecutorLease[] = [];
const clients: pg.Client[] = [];
afterAll(async () => {
  await Promise.allSettled(leases.map((lease) => lease.release()));
  await Promise.allSettled(clients.map((client) => client.end()));
});

async function connect(): Promise<pg.Client> {
  const client = new pg.Client({ connectionString });
  await client.connect();
  clients.push(client);
  return client;
}

async function tryLock(client: pg.Client, executorId: string): Promise<boolean> {
  const { rows } = await client.query<{ locked: boolean }>(
    "select pg_try_advisory_lock(hashtextextended($1, 0)) as locked",
    [leaseKey(executorId)],
  );
  return rows[0]?.locked === true;
}

describe("lock del executor", () => {
  it("mientras un proceso lo tiene, nadie más puede tomarlo; al soltarlo, sí", async () => {
    const executorId = `test-${randomUUID().slice(0, 8)}`;
    const lease = await acquireExecutorLease({ connectionString, executorId, logger, onLost: () => {} });
    const other = await connect();
    expect(await tryLock(other, executorId)).toBe(false);

    await lease.release();
    expect(await tryLock(other, executorId)).toBe(true);
  });

  it("si la conexión del lock se cae, avisa con onLost (y el lock queda libre)", async () => {
    const executorId = `test-${randomUUID().slice(0, 8)}`;
    let lost: Error | undefined;
    const lease = await acquireExecutorLease({
      connectionString,
      executorId,
      logger,
      onLost: (err) => (lost = err),
    });
    leases.push(lease);

    // Otra sesión del mismo rol corta la conexión del lock, como haría una
    // caída de red o un reinicio de la base de datos.
    const other = await connect();
    const { rows } = await other.query<{ pid: number }>(
      `select pid from pg_locks where locktype = 'advisory' and granted
         and (classid::bigint << 32) | objid::bigint = hashtextextended($1, 0)`,
      [leaseKey(executorId)],
    );
    expect(rows).toHaveLength(1);
    await other.query("select pg_terminate_backend($1)", [rows[0]?.pid]);

    const deadline = Date.now() + 5_000;
    while (!lost && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 50));
    expect(lost).toBeInstanceOf(Error);
    expect(await tryLock(other, executorId)).toBe(true);
  });

  it("deja de esperar si se cancela (SIGTERM antes de arrancar)", async () => {
    const executorId = `test-${randomUUID().slice(0, 8)}`;
    const holder = await connect();
    expect(await tryLock(holder, executorId)).toBe(true);

    const controller = new AbortController();
    const waiting = acquireExecutorLease({
      connectionString,
      executorId,
      logger,
      onLost: () => {},
      signal: controller.signal,
      retryMs: 50,
    });
    setTimeout(() => controller.abort(), 200);
    await expect(waiting).rejects.toBeInstanceOf(LeaseAbortedError);
  });
});
