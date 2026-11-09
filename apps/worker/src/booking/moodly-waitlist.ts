import type { TenantDb } from "@repo/db/service";
import type { WaitlistEntry, WaitlistStore } from "@repo/skills";

// La lista de espera en la base de datos de Moodly (paso 4f-1). Las reglas las
// impone la base de datos: la misma organización en todo, la conversación del
// contacto, el servicio del local, una sola entrada viva por contacto,
// servicio y local, y una entrada por ejecución (idempotency_key).

const COLUMNS = "id, service_id, wanted_from, wanted_until, status";

interface EntryRow {
  id: string;
  service_id: string;
  wanted_from: string;
  wanted_until: string;
  status: string;
}

function toEntry(row: EntryRow): WaitlistEntry {
  return {
    id: row.id,
    serviceId: row.service_id,
    wantedFrom: new Date(row.wanted_from),
    wantedUntil: new Date(row.wanted_until),
    status: row.status,
  };
}

export class WaitlistRejectedError extends Error {
  override name = "WaitlistRejectedError";
}

export function createMoodlyWaitlist(db: TenantDb): WaitlistStore {
  return {
    async join({ locationId, contactId, conversationId, serviceId, wantedFrom, wantedUntil, idempotencyKey }) {
      const inserted = await db
        .from("waitlist_entries")
        .insert({
          location_id: locationId,
          contact_id: contactId,
          conversation_id: conversationId,
          service_id: serviceId,
          wanted_from: wantedFrom.toISOString(),
          wanted_until: wantedUntil.toISOString(),
          idempotency_key: idempotencyKey,
        })
        .select(COLUMNS)
        .single();
      if (!inserted.error) return { entry: toEntry(inserted.data as EntryRow), alreadyWaiting: false };
      if (inserted.error.code === "23505") {
        // La misma ejecución otra vez (un reintento): la entrada que ya creó.
        const same = await db.from("waitlist_entries").select(COLUMNS).eq("idempotency_key", idempotencyKey).maybeSingle();
        if (same.error) throw new Error(`waitlist_entries: ${same.error.message}`);
        if (same.data) return { entry: toEntry(same.data as EntryRow), alreadyWaiting: false };
        // Ya estaba apuntado a ese servicio en ese local: la que tiene viva.
        const alive = await db
          .from("waitlist_entries")
          .select(COLUMNS)
          .eq("contact_id", contactId)
          .eq("service_id", serviceId)
          .eq("location_id", locationId)
          .in("status", ["waiting", "offered"])
          .maybeSingle();
        if (alive.error) throw new Error(`waitlist_entries: ${alive.error.message}`);
        if (alive.data) return { entry: toEntry(alive.data as EntryRow), alreadyWaiting: true };
      }
      if (inserted.error.code === "23514") throw new WaitlistRejectedError("el servicio no se ofrece en ese local o la franja no es válida");
      throw new Error(`waitlist_entries: ${inserted.error.message}`);
    },
  };
}
