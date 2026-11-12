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
//   puede cambiar:
//     · cada consulta va por el protocolo extendido (queryMode 'extended'), que
//       admite una sola sentencia: nada de «select 1; set …»;
//     · la sentencia tiene que empezar por select, insert, update, delete,
//       with, values o table (assertAllowedStatement): fuera SET, RESET,
//       DISCARD, DO, CALL, el control de la transacción y el resto;
//     · y no puede nombrar set_config ni usar identificadores U&"…" (con los
//       que se escribiría set_config sin que se vea);
//     · de respaldo, antes del COMMIT se comprueba que la organización sigue
//       siendo la misma; si no, se deshace todo.
// - El handle que recibe fn solo vale dentro de la transacción: usado después
//   (cuando la conexión ya ha vuelto al pool y puede estar en la transacción de
//   otra organización) lanza WorkerSqlError.
// - Cada conexión nueva comprueba, antes de entrarse al pool, que es de verdad
//   moodly_worker: current_user y session_user (una URL de postgres con
//   `-c role=moodly_worker` dejaría volver a postgres con RESET ROLE) y que el
//   rol no se salta RLS. Con una URL equivocada, RLS no actuaría y este acceso
//   dejaría de separar tenants.
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

/** Timeouts del pool: una consulta o una transacción colgada no retiene la conexión. */
export const WORKER_SQL_TIMEOUTS = {
  connectMs: 10_000,
  statementMs: 30_000,
  idleInTransactionMs: 60_000,
  idleClientMs: 30_000,
} as const;

const ALLOWED_FIRST_KEYWORDS = new Set(["select", "insert", "update", "delete", "with", "values", "table"]);

/** Quita los comentarios y los espacios del principio, para leer la primera palabra. */
function leadingKeyword(text: string): string {
  let rest = text;
  for (;;) {
    const trimmed = rest.replace(/^[\s(]+/, "");
    if (trimmed.startsWith("--")) {
      const end = trimmed.indexOf("\n");
      rest = end === -1 ? "" : trimmed.slice(end + 1);
    } else if (trimmed.startsWith("/*")) {
      const end = trimmed.indexOf("*/");
      rest = end === -1 ? "" : trimmed.slice(end + 2);
    } else {
      return (/^[a-z]+/i.exec(trimmed)?.[0] ?? "").toLowerCase();
    }
  }
}

/** Una sentencia de quien llama no puede tocar la organización, el rol ni la transacción. */
export function assertAllowedStatement(text: string): void {
  const keyword = leadingKeyword(text);
  if (!ALLOWED_FIRST_KEYWORDS.has(keyword)) {
    throw new WorkerSqlError(`workerSql: solo se admiten consultas (select, insert, update, delete, with…), no «${keyword || "?"}»`);
  }
  if (/set_config/i.test(text) || /u&\s*["']/i.test(text)) {
    throw new WorkerSqlError("workerSql: una consulta no puede cambiar la organización ni el rol de la transacción");
  }
}

export interface WorkerSql {
  /** Ejecuta fn en una transacción con la organización fijada; confirma si termina bien y deshace si falla. */
  inOrganization<T>(organizationId: string, fn: (sql: TenantSql) => Promise<T>): Promise<T>;
  end(): Promise<void>;
}

export interface WorkerSqlOptions {
  connectionString: string;
  max?: number;
  /** Errores de las conexiones libres del pool (sin manejador, uno tumbaría el proceso). Solo el error: nunca la conexión. */
  onError?: (error: Error) => void;
}

export async function verifyRole(client: Pick<pg.ClientBase, "query">): Promise<void> {
  const { rows } = await client.query<{ current: string; session: string; unsafe: boolean }>(
    `select current_user as current, session_user as session,
            exists (select 1 from pg_roles r where r.rolname in (current_user, session_user) and (r.rolbypassrls or r.rolsuper)) as unsafe`,
  );
  const row = rows[0];
  if (!row || row.current !== WORKER_ROLE || row.session !== WORKER_ROLE || row.unsafe) {
    throw new WorkerSqlError(
      `workerSql: la conexión tiene que ser ${WORKER_ROLE} (current_user y session_user), sin BYPASSRLS (es ${row?.session ?? "?"}/${row?.current ?? "?"})`,
    );
  }
}

export function createWorkerSql(options: WorkerSqlOptions): WorkerSql {
  const pool = new pg.Pool({
    connectionString: options.connectionString,
    max: options.max ?? 5,
    application_name: "moodly_worker_sql",
    connectionTimeoutMillis: WORKER_SQL_TIMEOUTS.connectMs,
    idleTimeoutMillis: WORKER_SQL_TIMEOUTS.idleClientMs,
    statement_timeout: WORKER_SQL_TIMEOUTS.statementMs,
    idle_in_transaction_session_timeout: WORKER_SQL_TIMEOUTS.idleInTransactionMs,
    // pg-pool lo espera antes de entregar la conexión: si falla, no se entrega.
    onConnect: verifyRole,
  });
  pool.on("error", (error) => {
    options.onError?.(new Error(error.message));
  });

  async function inOrganization<T>(organizationId: string, fn: (sql: TenantSql) => Promise<T>): Promise<T> {
    const client = await pool.connect();
    let closed = false;
    try {
      await client.query("begin");
      // El uuid se valida en Postgres (::uuid): una organización mal formada no abre la transacción.
      const { rows } = await client.query<{ org: string }>("select set_config($1, $2::uuid::text, true) as org", [SCOPE_SETTING, organizationId]);
      const scoped = rows[0]?.org;
      const sql: TenantSql = {
        async query(text, values) {
          if (closed) throw new WorkerSqlError("workerSql: la transacción ya terminó; este handle no vale fuera de ella");
          assertAllowedStatement(text);
          // queryMode existe en pg 8 (lib/query.js) aunque @types/pg no lo declare.
          const config = { text, values: values ? [...values] : [], queryMode: "extended" } as pg.QueryConfig<unknown[]>;
          const result = await client.query(config);
          return result.rows;
        },
      };
      const value = await fn(sql);
      closed = true;
      // Respaldo: si algo hubiera cambiado la organización, no se confirma nada.
      const check = await client.query<{ org: string | null }>("select current_setting($1, true) as org", [SCOPE_SETTING]);
      if (!scoped || check.rows[0]?.org !== scoped) {
        throw new WorkerSqlError("workerSql: la organización cambió dentro de la transacción; se deshace");
      }
      await client.query("commit");
      return value;
    } catch (error) {
      await client.query("rollback").catch(() => undefined);
      throw error;
    } finally {
      closed = true;
      client.release();
    }
  }

  return { inOrganization, end: () => pool.end() };
}
