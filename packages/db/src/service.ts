// Cliente de plataforma (clave secreta de Supabase) para el worker: el único
// sitio del código de producción que lo crea. No devuelve el cliente: solo un
// acceso acotado a una organización (tenant-db.ts). Se importa desde
// @repo/db/service, que apps/web tiene prohibido (eslint.config.js).
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types.js";
import { outbox, type Outbox } from "./outbox.ts";
import { tenantDb, type TenantDb } from "./tenant-db.ts";
import { WorkerSqlError, createWorkerSql } from "./worker-sql.ts";

export { OutboxError, type Outbox, type PendingDomainEvent } from "./outbox.ts";
export { WorkerSqlError, type TenantSql } from "./worker-sql.ts";
export {
  TenantScopeError,
  type AgentTurnContext,
  type ApprovalNotification,
  type BookingSlotRow,
  type BookingSlotsParams,
  type KnowledgeSearchParams,
  type KnowledgeSearchRow,
  type TenantDb,
  type TenantInsert,
  type TenantTable,
  type TenantUpdate,
  type UsageSpend,
  type UsageSpendParams,
} from "./tenant-db.ts";

export interface ServiceDb {
  /** Datos de una organización. organizationId sale siempre del runtime, nunca de lo que genera el LLM. */
  forOrganization(organizationId: string): TenantDb;
  /** El publicador del outbox: metadatos de los eventos pendientes de todas las organizaciones (ADR 0009). */
  outbox: Outbox;
  /**
   * Comprueba que la conexión de moodly_worker funciona (login, rol, sin
   * BYPASSRLS). El worker la llama al arrancar: si falla, no arranca, en vez de
   * fallar después en cada turno.
   */
  verifyWorkerConnection(): Promise<void>;
  /** Cierra las conexiones SQL del rol moodly_worker, si las hay. */
  end(): Promise<void>;
}

export function createServiceDb(options: {
  url: string;
  secretKey: string;
  /** La conexión del rol moodly_worker (ADR 0049): activa forOrganization(…).transaction. */
  workerDatabaseUrl?: string;
  /** Errores de las conexiones libres del pool de moodly_worker (para el log del worker). */
  onWorkerSqlError?: (error: Error) => void;
}): ServiceDb {
  const client = createClient<Database>(options.url, options.secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const workerSql = options.workerDatabaseUrl ? createWorkerSql({
        connectionString: options.workerDatabaseUrl,
        ...(options.onWorkerSqlError ? { onError: options.onWorkerSqlError } : {}),
      }) : undefined;
  return {
    forOrganization: (organizationId) => tenantDb(client, organizationId, workerSql),
    outbox: outbox(client),
    verifyWorkerConnection: async () => {
      if (!workerSql) throw new WorkerSqlError("sin WORKER_DATABASE_URL no hay conexión de moodly_worker");
      await workerSql.verify();
    },
    end: async () => {
      await workerSql?.end();
    },
  };
}
