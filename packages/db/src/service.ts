// Cliente de plataforma (clave secreta de Supabase) para el worker: el único
// sitio del código de producción que lo crea. No devuelve el cliente: solo un
// acceso acotado a una organización (tenant-db.ts) y dos lecturas entre
// organizaciones, con nombre y acotadas: los metadatos del outbox (ADR 0009) y
// la cuenta de un canal por (canal, id externo) (ADR 0052 §2). Se importa desde
// @repo/db/service, que apps/web tiene prohibido (eslint.config.js).
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types.js";
import { channelAccounts, type ChannelAccounts } from "./channel-accounts.ts";
import { outbox, type Outbox } from "./outbox.ts";
import { tenantDb, type TenantDb } from "./tenant-db.ts";
import { createWorkerSql } from "./worker-sql.ts";

export { ChannelAccountError, type ChannelAccounts, type ResolvedChannelAccount } from "./channel-accounts.ts";
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
   * La cuenta de un canal por (canal, id externo), para la entrada de canales
   * (ADR 0052 §2): id, organización y estado, y nada más. Solo después de
   * comprobar la firma del proveedor.
   */
  channelAccounts: ChannelAccounts;
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
    channelAccounts: channelAccounts(client),
    end: async () => {
      await workerSql?.end();
    },
  };
}
