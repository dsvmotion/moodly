import { z } from "zod";
import { ConnectorPlatformError, type ConnectorPlatform } from "../platform/types.js";
import { assertListRequest, cleanCalendarTitle, type CalendarEvent, type CalendarReader } from "./common.js";

export type { CalendarEvent, CalendarReader, ListUpcomingEventsRequest } from "./common.js";

// Lectura de Google Calendar a través de la plataforma de conectores (O-02,
// prueba del hub): los próximos eventos del calendario principal de la cuenta
// conectada. Solo lectura; escribir llegará con su skill y su política
// (ADR 0047), y CalendarProvider completo con int-googlecalendar.
//
// Una instancia es de UNA conexión (la de una organización): quien la crea lee
// el id de la fila con forOrganization, nunca de lo que genera el modelo. Lo
// que devuelve Google es un dato no confiable: se valida, se recorta y se
// quitan los caracteres de control antes de devolverlo.

export const GOOGLE_CALENDAR_EVENTS_PATH = "/calendar/v3/calendars/primary/events";

const when = z.object({ dateTime: z.string().optional(), date: z.string().optional() }).passthrough();
const eventsResponse = z.object({
  items: z
    .array(
      z
        .object({
          id: z.string().min(1).max(1024),
          status: z.string().optional(),
          summary: z.string().optional(),
          start: when.optional(),
          end: when.optional(),
        })
        .passthrough(),
    )
    .optional(),
});

function toDate(value: z.infer<typeof when> | undefined): { date: Date; allDay: boolean } | null {
  if (!value) return null;
  const raw = value.dateTime ?? value.date;
  if (!raw) return null;
  // Un día entero viene como AAAA-MM-DD: medianoche UTC de ese día.
  const date = new Date(value.dateTime ? raw : `${raw}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : { date, allDay: !value.dateTime };
}

export function createGoogleCalendarReader(
  platform: ConnectorPlatform,
  connection: { integrationKey: string; connectionId: string },
): CalendarReader {
  return {
    async listUpcomingEvents({ from, limit }) {
      assertListRequest({ from, limit });
      const body = await platform.proxy({
        integrationKey: connection.integrationKey,
        connectionId: connection.connectionId,
        method: "GET",
        path: GOOGLE_CALENDAR_EVENTS_PATH,
        query: {
          timeMin: from.toISOString(),
          singleEvents: "true",
          orderBy: "startTime",
          maxResults: String(limit),
        },
      });
      const parsed = eventsResponse.safeParse(body);
      if (!parsed.success) throw new ConnectorPlatformError("Google Calendar devolvió algo inesperado", null, "rejected");
      const events: CalendarEvent[] = [];
      for (const item of parsed.data.items ?? []) {
        if (item.status === "cancelled") continue;
        const start = toDate(item.start);
        if (!start) continue;
        const end = toDate(item.end);
        events.push({ id: item.id, title: cleanCalendarTitle(item.summary), startsAt: start.date, endsAt: end?.date ?? null, allDay: start.allDay });
        if (events.length >= limit) break;
      }
      return events;
    },
  };
}
