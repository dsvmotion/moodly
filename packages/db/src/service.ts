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

export { ChannelAccountError, type ChannelAccounts, type ResolvedChannelAccount } from "./channel-accounts.ts";
export { OutboxError, type Outbox, type PendingDomainEvent } from "./outbox.ts";
export {
  TenantScopeError,
  type AgentTurnContext,
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
  /**
   * La cuenta de un canal por (canal, id externo), para la entrada de canales
   * (ADR 0052 §2): id, organización y estado, y nada más. Solo después de
   * comprobar la firma del proveedor.
   */
  channelAccounts: ChannelAccounts;
}

export function createServiceDb(options: { url: string; secretKey: string }): ServiceDb {
  const client = createClient<Database>(options.url, options.secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return {
    forOrganization: (organizationId) => tenantDb(client, organizationId),
    outbox: outbox(client),
    channelAccounts: channelAccounts(client),
  };
}
