// PL-T1, paso 2a (ADR 0049, opción C): el acceso del worker a los datos de una
// organización por SQL, bajo RLS, con el rol moodly_worker (migración
// 20261112040500_worker_role). Convive con el acceso por PostgREST de
// tenant-db.ts mientras los módulos se mudan uno a uno.
//
// - Cada unidad de trabajo es una transacción que empieza fijando la
//   organización: set_config('moodly.organization_id', <org>, true), local a la
//   transacción. Las políticas <tabla>_worker solo dejan ver y escribir las filas
//   de esa organización; sin ella, el rol no ve nada.
// - La organización la pone forOrganization(orgId): sale del runtime (la fila
//   del evento), nunca de lo que genera el LLM. Quien escribe la consulta no la
//   puede cambiar: set_config está reservado a este módulo, y una sentencia que
//   lo intente se rechaza (assertNoScopeChange).
// - Antes de la primera transacción comprueba que la conexión es de verdad
//   moodly_worker y que el rol no se salta RLS: con una URL equivocada (postgres,
//   service_role) RLS no actuaría y este acceso dejaría de separar tenants.
import pg from "pg";

/** Las consultas de una transacción, ya acotadas a la organización por RLS. */
export interface TenantSql {
  query<R extends pg.QueryResultRow = pg.QueryResultRow>(text: string, values?: readonly unknown[]): Promise<R[]>;
}

export class WorkerSqlError extends Error {
  override readonly name = "WorkerSqlError";
}

const WORKER_ROLE = "moodly_worker";
const SCOPE_SETTING = "moodly.organization_id";

/** Una sentencia de quien llama no puede tocar la organización ni el rol de la transacción. */
function assertNoScopeChange(text: string): void {
  const normalized = text.toLowerCase();
  if (normalized.includes(SCOPE_SETTING) || /\bset\s+(local\s+)?role\b/.test(normalized) || /\bset_config\s*\(/.test(normalized)) {
    throw new WorkerSqlError("workerSql: una consulta no puede cambiar la organización ni el rol de la transacción");
  }
}

export interface WorkerSql {
  /** Ejecuta fn en una transacción con la organización fijada; confirma si termina bien y deshace si falla. */
  inOrganization<T>(organizationId: string, fn: (sql: TenantSql) => Promise<T>): Promise<T>;
  end(): Promise<void>;
}

export function createWorkerSql(options: { connectionString: string; max?: number }): WorkerSql {
  const pool = new pg.Pool({ connectionString: options.connectionString, max: options.max ?? 5 });
  let verified: Promise<void> | undefined;

  async function verifyRole(client: pg.PoolClient): Promise<void> {
    const { rows } = await client.query<{ role: string; bypass: boolean; superuser: boolean }>(
      `select current_user as role, r.rolbypassrls as bypass, r.rolsuper as superuser
       from pg_roles r where r.rolname = current_user`,
    );
    const row = rows[0];
    if (!row || row.role !== WORKER_ROLE || row.bypass || row.superuser) {
      throw new WorkerSqlError(`workerSql: la conexión tiene que ser ${WORKER_ROLE}, sin BYPASSRLS (es ${row?.role ?? "?"})`);
    }
  }

  async function inOrganization<T>(organizationId: string, fn: (sql: TenantSql) => Promise<T>): Promise<T> {
    const client = await pool.connect();
    try {
      verified ??= verifyRole(client).catch((error: unknown) => {
        verified = undefined;
        throw error;
      });
      await verified;
      await client.query("begin");
      // El uuid se valida en Postgres (::uuid): una organización mal formada no abre la transacción.
      await client.query("select set_config($1, $2::uuid::text, true)", [SCOPE_SETTING, organizationId]);
      const sql: TenantSql = {
        async query(text, values) {
          assertNoScopeChange(text);
          const result = await client.query(text, values as unknown[] | undefined);
          return result.rows;
        },
      };
      const value = await fn(sql);
      await client.query("commit");
      return value;
    } catch (error) {
      await client.query("rollback").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  return { inOrganization, end: () => pool.end() };
}
