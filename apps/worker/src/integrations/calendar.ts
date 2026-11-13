import type { ServiceDb } from "@repo/db/service";
import {
  createGoogleCalendarReader,
  platformIntegration,
  type CalendarEvent,
  type ConnectorPlatform,
} from "@repo/integrations";

// La prueba del hub (O-02): los próximos eventos del Google Calendar que una
// organización conectó. Solo lectura y todavía sin skill (no llega al modelo):
// la skill calendar.list_events, con su clase de efecto, decide() y la
// herramienta fijada por huella, es el incremento siguiente (ADR 0053 §4).
//
// - La organización la pone quien llama desde el runtime (la fila del evento o
//   del run), nunca lo que genera el modelo.
// - El id de la conexión sale de la fila, con forOrganization(org).transaction
//   (moodly_worker, RLS): una organización nunca usa la conexión de otra.

export const GOOGLE_CALENDAR_PROVIDER = "google-calendar";

export interface UpcomingEventsRequest {
  db: ServiceDb;
  platform: ConnectorPlatform;
  organizationId: string;
  from: Date;
  limit: number;
}

/** Los próximos eventos, o null si la organización no tiene Google Calendar conectado. */
export async function listUpcomingCalendarEvents(request: UpcomingEventsRequest): Promise<CalendarEvent[] | null> {
  const entry = platformIntegration(GOOGLE_CALENDAR_PROVIDER);
  if (!entry) throw new Error("google-calendar no está en el catálogo de integraciones de plataforma");
  const [row] = await request.db.forOrganization(request.organizationId).transaction((sql) =>
    sql.query<{ external_connection_id: string }>(
      `select external_connection_id from public.integrations
        where organization_id = $1 and provider = $2 and kind = 'platform' and status = 'active'
          and location_id is null and external_connection_id is not null
        limit 1`,
      [request.organizationId, entry.provider],
    ),
  );
  if (!row) return null;
  const reader = createGoogleCalendarReader(request.platform, {
    integrationKey: entry.integrationKey,
    connectionId: row.external_connection_id,
  });
  return reader.listUpcomingEvents({ from: request.from, limit: request.limit });
}
