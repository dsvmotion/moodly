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

/** Un tramo ocupado del calendario conectado (O-02): solo el intervalo, nada de lo que escribió nadie fuera. */
export interface BusyInterval {
  startsAt: Date;
  endsAt: Date;
}

export interface ListBusyRequest {
  from: Date;
  to: Date;
  /** Tope de eventos que se leen (1–250); una ventana con más se trunca (cubre de sobra una búsqueda de huecos). */
  limit: number;
}

export interface CalendarReader {
  listUpcomingEvents(request: ListUpcomingEventsRequest): Promise<CalendarEvent[]>;
  /**
   * Los tramos ocupados entre `from` y `to`: se saltan los eventos cancelados y
   * los marcados «libre» (transparency/showAs). Un evento de día entero ocupa
   * desde la medianoche UTC de su día hasta la del día siguiente. Un evento sin
   * fin no cuenta (no se puede restar un hueco). Recorta a `limit`.
   */
  listBusy(request: ListBusyRequest): Promise<BusyInterval[]>;
}

export const BUSY_MAX = 250;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Lanza RangeError si la ventana no vale (antes de llamar a nadie). */
export function assertBusyRequest({ from, to, limit }: ListBusyRequest): void {
  if (!Number.isInteger(limit) || limit < 1 || limit > BUSY_MAX) throw new RangeError(`limit: entre 1 y ${BUSY_MAX}`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) throw new RangeError("from/to no son fechas");
  if (to.getTime() <= from.getTime()) throw new RangeError("to tiene que ir después de from");
}

/** El tramo ocupado de un evento ya validado, o null si no bloquea (sin fin, o fin que no va después del inicio). */
export function busyFromEvent(start: { date: Date; allDay: boolean }, end: { date: Date; allDay: boolean } | null): BusyInterval | null {
  if (start.allDay) {
    // Un día entero (o varios): de su medianoche UTC a la del día siguiente al último.
    const endExclusive = end ? end.date : new Date(start.date.getTime() + DAY_MS);
    const endsAt = endExclusive.getTime() > start.date.getTime() ? endExclusive : new Date(start.date.getTime() + DAY_MS);
    return { startsAt: start.date, endsAt };
  }
  if (!end || end.date.getTime() <= start.date.getTime()) return null;
  return { startsAt: start.date, endsAt: end.date };
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
