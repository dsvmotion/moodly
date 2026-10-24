// Acceso del publicador del outbox (ADR 0009) a domain_events: lo único que la
// plataforma lee entre organizaciones. Solo ve los metadatos de los pendientes
// (id, organización y tipo), nunca el payload, y solo puede marcarlos como
// publicados. Cada entrega lee después su evento con forOrganization(la
// organización de la fila): el tenant sale de la fila, no del payload (3.7).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types.js";

export interface PendingDomainEvent {
  id: string;
  organizationId: string;
  type: string;
}

export interface Outbox {
  /** Los pendientes de publicar, los más antiguos primero (entre 1 y 500). */
  pending(limit: number): Promise<PendingDomainEvent[]>;
  /** Marca como publicados los que sigan pendientes; devuelve cuántos ha marcado. */
  markPublished(ids: readonly string[]): Promise<number>;
}

export class OutboxError extends Error {
  override readonly name = "OutboxError";
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BATCH = 500;

export function outbox(client: SupabaseClient<Database>): Outbox {
  return {
    async pending(limit) {
      if (!Number.isInteger(limit) || limit < 1 || limit > MAX_BATCH) {
        throw new OutboxError(`outbox: el lote va de 1 a ${MAX_BATCH} eventos`);
      }
      const { data, error } = await client
        .from("domain_events")
        .select("id, organization_id, type")
        .is("published_at", null)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .limit(limit);
      if (error) throw new OutboxError(`outbox: no se pudieron leer los pendientes (${error.code})`);
      return data.map((row) => ({ id: row.id, organizationId: row.organization_id, type: row.type }));
    },

    async markPublished(ids) {
      if (ids.length === 0) return 0;
      if (ids.length > MAX_BATCH || !ids.every((id) => UUID.test(id))) {
        throw new OutboxError(`outbox: hasta ${MAX_BATCH} ids de evento válidos`);
      }
      // La hora la pone la base de datos (trigger set_published_at); el filtro
      // por pendientes hace que publicar dos veces no cambie nada.
      const { data, error } = await client
        .from("domain_events")
        .update({ published_at: new Date().toISOString() })
        .in("id", [...ids])
        .is("published_at", null)
        .select("id");
      if (error) throw new OutboxError(`outbox: no se pudieron marcar como publicados (${error.code})`);
      return data.length;
    },
  };
}
