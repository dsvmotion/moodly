import { z } from "zod";
import { ConnectorPlatformError, type ConnectorPlatform } from "../platform/types.js";
import {
  assertBusyRequest,
  assertListRequest,
  busyFromEvent,
  cleanCalendarTitle,
  type BusyInterval,
  type CalendarEvent,
  type CalendarReader,
} from "./common.js";

// Lectura del calendario de Microsoft 365 / Outlook a través de la plataforma de
// conectores (O-02): los próximos eventos del calendario de la cuenta conectada,
// por Microsoft Graph (el proxy de Nango apunta a https://graph.microsoft.com).
// Devuelve la misma forma que Google (CalendarEvent). Solo lectura: la conexión
// se pide con Calendars.Read y offline_access (catalog.ts), nunca «.default».
//
// - /me/calendarView expande las series (como singleEvents en Google) y pide
//   un rango cerrado: desde `from` hasta OUTLOOK_CALENDAR_HORIZON_DAYS después.
// - Sin la cabecera Prefer: outlook.timezone, Graph devuelve las horas en UTC
//   (timeZone «UTC», sin desfase en el texto). Un evento con otra zona no se
//   puede convertir sin adivinar: se salta.
// - Una instancia es de UNA conexión (la de una organización): quien la crea lee
//   el id de la fila con forOrganization, nunca de lo que genera el modelo. Lo
//   que devuelve Microsoft es un dato no confiable: se valida, se recorta y se
//   quitan los caracteres de control antes de devolverlo.

export const OUTLOOK_CALENDAR_VIEW_PATH = "/v1.0/me/calendarView";
export const OUTLOOK_CALENDAR_HORIZON_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

const when = z.object({ dateTime: z.string().max(64), timeZone: z.string().max(64).optional() }).passthrough();
const viewItem = z
  .object({
    id: z.string().min(1).max(1024),
    subject: z.string().nullish(),
    isAllDay: z.boolean().optional(),
    isCancelled: z.boolean().optional(),
    showAs: z.string().nullish(),
    start: when.nullish(),
    end: when.nullish(),
  })
  .passthrough();
const viewResponse = z.object({ value: z.array(viewItem) });

// «2026-11-14T10:00:00.0000000»: Graph manda hasta 7 decimales y sin zona.
const GRAPH_DATE_TIME = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,7}))?$/;

function toUtcDate(value: z.infer<typeof when> | null | undefined): Date | null {
  if (!value) return null;
  if ((value.timeZone ?? "UTC") !== "UTC") return null;
  const match = GRAPH_DATE_TIME.exec(value.dateTime);
  if (!match) return null;
  const millis = (match[2] ?? "").padEnd(3, "0").slice(0, 3);
  const date = new Date(`${match[1]}.${millis}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function createOutlookCalendarReader(
  platform: ConnectorPlatform,
  connection: { integrationKey: string; connectionId: string },
): CalendarReader {
  return {
    async listUpcomingEvents({ from, limit }) {
      assertListRequest({ from, limit });
      const until = new Date(from.getTime() + OUTLOOK_CALENDAR_HORIZON_DAYS * DAY_MS);
      const body = await platform.proxy({
        integrationKey: connection.integrationKey,
        connectionId: connection.connectionId,
        method: "GET",
        path: OUTLOOK_CALENDAR_VIEW_PATH,
        query: {
          startDateTime: from.toISOString(),
          endDateTime: until.toISOString(),
          $orderby: "start/dateTime",
          $top: String(limit),
          $select: "id,subject,start,end,isAllDay,isCancelled",
        },
      });
      const parsed = viewResponse.safeParse(body);
      if (!parsed.success) throw new ConnectorPlatformError("Outlook devolvió algo inesperado", null, "rejected");
      const events: CalendarEvent[] = [];
      for (const item of parsed.data.value) {
        if (item.isCancelled) continue;
        const startsAt = toUtcDate(item.start);
        if (!startsAt) continue;
        events.push({
          id: item.id,
          title: cleanCalendarTitle(item.subject),
          startsAt,
          endsAt: toUtcDate(item.end),
          allDay: item.isAllDay === true,
        });
        if (events.length >= limit) break;
      }
      return events;
    },

    async listBusy({ from, to, limit }) {
      assertBusyRequest({ from, to, limit });
      const body = await platform.proxy({
        integrationKey: connection.integrationKey,
        connectionId: connection.connectionId,
        method: "GET",
        path: OUTLOOK_CALENDAR_VIEW_PATH,
        query: {
          startDateTime: from.toISOString(),
          endDateTime: to.toISOString(),
          $orderby: "start/dateTime",
          $top: String(limit),
          $select: "id,start,end,isAllDay,isCancelled,showAs",
        },
      });
      const parsed = viewResponse.safeParse(body);
      if (!parsed.success) throw new ConnectorPlatformError("Outlook devolvió algo inesperado", null, "rejected");
      const busy: BusyInterval[] = [];
      for (const item of parsed.data.value) {
        if (item.isCancelled || item.showAs === "free") continue;
        const startsAt = toUtcDate(item.start);
        if (!startsAt) continue;
        const endsAt = toUtcDate(item.end);
        const interval = busyFromEvent({ date: startsAt, allDay: item.isAllDay === true }, endsAt ? { date: endsAt, allDay: item.isAllDay === true } : null);
        if (interval) busy.push(interval);
        if (busy.length >= limit) break;
      }
      return busy;
    },
  };
}
