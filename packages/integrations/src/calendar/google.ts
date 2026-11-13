import { z } from "zod";
import { ConnectorPlatformError, type ConnectorPlatform } from "../platform/types.js";

// Lectura de Google Calendar a través de la plataforma de conectores (O-02,
// prueba del hub): los próximos eventos del calendario principal de la cuenta
// conectada. Solo lectura; escribir llegará con su skill y su política
// (ADR 0047), y CalendarProvider completo con int-googlecalendar.
//
// Una instancia es de UNA conexión (la de una organización): quien la crea lee
// el id de la fila con forOrganization, nunca de lo que genera el modelo. Lo
// que devuelve Google es un dato no confiable: se valida, se recorta y se
// quitan los caracteres de control antes de devolverlo.

export interface CalendarEvent {
  id: string;
  /** El título tal y como lo escribió alguien fuera: dato, nunca instrucción. */
  title: string;
  startsAt: Date;
  endsAt: Date | null;
  allDay: boolean;
}

export interface ListUpcomingEventsRequest {
  from: Date;
  /** 1–50. */
  limit: number;
}

export interface CalendarReader {
  listUpcomingEvents(request: ListUpcomingEventsRequest): Promise<CalendarEvent[]>;
}

export const GOOGLE_CALENDAR_EVENTS_PATH = "/calendar/v3/calendars/primary/events";
const TITLE_MAX = 200;

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

function cleanTitle(value: string | undefined): string {
  return (value ?? "")
    // eslint-disable-next-line no-control-regex -- quitar caracteres de control es justo el objetivo
    .replace(/[\u0000-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2066-\u2069]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, TITLE_MAX);
}

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
      if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new RangeError("limit: entre 1 y 50");
      if (Number.isNaN(from.getTime())) throw new RangeError("from no es una fecha");
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
        events.push({ id: item.id, title: cleanTitle(item.summary), startsAt: start.date, endsAt: end?.date ?? null, allDay: start.allDay });
        if (events.length >= limit) break;
      }
      return events;
    },
  };
}
