// Cliente de plataforma (clave secreta de Supabase) para el worker: el único
// sitio del código de producción que lo crea. No devuelve el cliente: solo un
// acceso acotado a una organización (tenant-db.ts). Se importa desde
// @repo/db/service, que apps/web tiene prohibido (eslint.config.js).
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types.js";
import { outbox, type Outbox } from "./outbox.ts";
import { tenantDb, type TenantDb } from "./tenant-db.ts";

export { OutboxError, type Outbox, type PendingDomainEvent } from "./outbox.ts";
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
} from "./tenant-db.ts";

export interface ServiceDb {
  /** Datos de una organización. organizationId sale siempre del runtime, nunca de lo que genera el LLM. */
  forOrganization(organizationId: string): TenantDb;
  /** El publicador del outbox: metadatos de los eventos pendientes de todas las organizaciones (ADR 0009). */
  outbox: Outbox;
}

export function createServiceDb(options: { url: string; secretKey: string }): ServiceDb {
  const client = createClient<Database>(options.url, options.secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return { forOrganization: (organizationId) => tenantDb(client, organizationId), outbox: outbox(client) };
}
