import type { ServiceDb } from "@repo/db/service";
import {
  createGoogleCalendarReader,
  createOutlookCalendarReader,
  platformIntegration,
  platformIntegrationsIn,
  type CalendarEvent,
  type CalendarReader,
  type ConnectorPlatform,
} from "@repo/integrations";

// La prueba del hub (O-02): los próximos eventos del calendario que una
// organización conectó, sea Google Calendar o Microsoft 365 / Outlook (la misma
// forma, CalendarEvent). Solo lectura y todavía sin skill (no llega al modelo):
// la skill calendar.list_events, con su clase de efecto, decide() y la
// herramienta fijada por huella, es el incremento siguiente (ADR 0053 §4).
//
// - La organización la pone quien llama desde el runtime (la fila del evento o
//   del run), nunca lo que genera el modelo.
// - El id de la conexión sale de la fila, con forOrganization(org).transaction
//   (moodly_worker, RLS): una organización nunca usa la conexión de otra.
// - Con más de un calendario conectado, el último que se activó.

export const GOOGLE_CALENDAR_PROVIDER = "google-calendar";
export const OUTLOOK_CALENDAR_PROVIDER = "outlook-calendar";

type ReaderFactory = (platform: ConnectorPlatform, connection: { integrationKey: string; connectionId: string }) => CalendarReader;

/** El lector de cada calendario del catálogo. Un calendario sin lector no se puede leer (lo vigila calendar.test.ts). */
export const CALENDAR_READERS: Readonly<Record<string, ReaderFactory>> = Object.freeze({
  [GOOGLE_CALENDAR_PROVIDER]: createGoogleCalendarReader,
  [OUTLOOK_CALENDAR_PROVIDER]: createOutlookCalendarReader,
});

export interface UpcomingEventsRequest {
  db: ServiceDb;
  platform: ConnectorPlatform;
  organizationId: string;
  from: Date;
  limit: number;
}

/** Los próximos eventos, o null si la organización no tiene ningún calendario conectado. */
export async function listUpcomingCalendarEvents(request: UpcomingEventsRequest): Promise<CalendarEvent[] | null> {
  const providers = platformIntegrationsIn("calendar")
    .map((entry) => entry.provider)
    .filter((provider) => provider in CALENDAR_READERS);
  const [row] = await request.db.forOrganization(request.organizationId).transaction((sql) =>
    sql.query<{ provider: string; external_connection_id: string }>(
      `select provider, external_connection_id from public.integrations
        where organization_id = $1 and provider = any($2::text[]) and kind = 'platform' and status = 'active'
          and location_id is null and external_connection_id is not null
        order by last_health_check desc nulls last, provider
        limit 1`,
      [request.organizationId, providers],
    ),
  );
  if (!row) return null;
  const entry = platformIntegration(row.provider);
  const reader = CALENDAR_READERS[row.provider];
  if (!entry || !reader) throw new Error("un calendario conectado no está en el catálogo");
  return reader(request.platform, { integrationKey: entry.integrationKey, connectionId: row.external_connection_id }).listUpcomingEvents({
    from: request.from,
    limit: request.limit,
  });
}
