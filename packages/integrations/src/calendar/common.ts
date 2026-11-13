// Lo común a los lectores de calendario de la plataforma (O-02): la forma de
// un evento, que es la misma venga de Google o de Microsoft, y la limpieza de
// lo que escribió alguien fuera. Lo que devuelve el proveedor es un dato no
// confiable: se valida, se recorta y se quitan los caracteres de control.

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

export const CALENDAR_TITLE_MAX = 200;

export function cleanCalendarTitle(value: string | null | undefined): string {
  return (value ?? "")
    // eslint-disable-next-line no-control-regex -- quitar caracteres de control es justo el objetivo
    .replace(/[\u0000-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2066-\u2069]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, CALENDAR_TITLE_MAX);
}

/** Lanza RangeError si la petición no vale (antes de llamar a nadie). */
export function assertListRequest({ from, limit }: ListUpcomingEventsRequest): void {
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new RangeError("limit: entre 1 y 50");
  if (Number.isNaN(from.getTime())) throw new RangeError("from no es una fecha");
}
