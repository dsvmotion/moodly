// La agenda de citas (OA03, MANUAL §9.4 `/app/calendar`): vista de día y de
// semana. Lógica pura: qué días se ven, qué ventana se pide a la base de datos y
// en qué día cae cada cita. Cada cita va en el día y la hora de su sede, en la
// zona horaria de la sede (decisión de producto del 2026-11-10, M-08): la misma
// hora local en Madrid y en Canarias son instantes distintos, y una cita de
// Canarias a las 23:30 cae en su día aunque en Madrid ya sea el siguiente.

export type CalendarView = "day" | "week";

export const VIEW_PARAM = "view";
export const DATE_PARAM = "date";

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** La vista de la URL; cualquier otra cosa, la de día. */
export function parseView(value: unknown): CalendarView {
  return value === "week" ? "week" : "day";
}

/** Una fecha «YYYY-MM-DD» de la URL si es de verdad una fecha; si no, `fallback`. */
export function parseDate(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const match = DATE_RE.exec(value);
  if (!match) return fallback;
  const [, y, m, d] = match.map(Number) as [number, number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d ? value : fallback;
}

/** El día de hoy en esa zona, como «YYYY-MM-DD». */
export function todayIn(timeZone: string, now: Date = new Date()): string {
  return localDate(now.toISOString(), timeZone);
}

/** El día (en la zona dada) en el que cae un instante, como «YYYY-MM-DD». */
export function localDate(iso: string, timeZone: string): string {
  // en-CA escribe las fechas como YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}

function toUtc(date: string): Date {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d));
}

function fromUtc(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** La fecha `days` días después (o antes, con un número negativo). */
export function shiftDate(date: string, days: number): string {
  const d = toUtc(date);
  d.setUTCDate(d.getUTCDate() + days);
  return fromUtc(d);
}

/** Los días que se ven: el de la fecha, o su semana de lunes a domingo. */
export function calendarDays(view: CalendarView, date: string): string[] {
  if (view === "day") return [date];
  const weekday = toUtc(date).getUTCDay(); // 0 domingo … 6 sábado
  const monday = shiftDate(date, -((weekday + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => shiftDate(monday, i));
}

/** La fecha a la que llevan «anterior» y «siguiente»: un día o una semana. */
export function stepDate(view: CalendarView, date: string, direction: -1 | 1): string {
  return shiftDate(date, direction * (view === "week" ? 7 : 1));
}

/** Cuántos minutos va por delante de UTC esa zona en ese instante (Europe/Madrid en invierno: 60). */
function offsetMinutes(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const asUtc = Date.UTC(value("year"), value("month") - 1, value("day"), value("hour"), value("minute"), value("second"));
  return Math.round((asUtc - at.getTime()) / 60_000);
}

/** El instante en que empieza ese día (00:00) en esa zona, también los días de cambio de hora. */
export function startOfDayIn(date: string, timeZone: string): Date {
  const guess = toUtc(date).getTime();
  let at = new Date(guess - offsetMinutes(new Date(guess), timeZone) * 60_000);
  // Si el cambio de hora cae entre la suposición y el resultado, el segundo intento ya usa el desfase bueno.
  at = new Date(guess - offsetMinutes(at, timeZone) * 60_000);
  return at;
}

/**
 * La ventana de instantes que se pide a la base de datos: desde las 00:00 del
 * primer día hasta las 00:00 del día siguiente al último, en cada zona de las
 * sedes que se ven (de la que empieza antes a la que acaba después). Así el tope
 * de filas cuenta solo lo de los días visibles; lo que sobra entre zonas lo
 * quita `groupByDay`, que pone cada cita en el día de su sede.
 */
export function queryWindow(days: readonly string[], timeZones: readonly string[]): { from: string; to: string } {
  const first = days[0];
  const last = days[days.length - 1];
  if (!first || !last) throw new Error("queryWindow: sin días");
  const zones = timeZones.length > 0 ? [...new Set(timeZones)] : ["UTC"];
  const from = Math.min(...zones.map((zone) => startOfDayIn(first, zone).getTime()));
  const to = Math.max(...zones.map((zone) => startOfDayIn(shiftDate(last, 1), zone).getTime()));
  return { from: new Date(from).toISOString(), to: new Date(to).toISOString() };
}

export interface CalendarAppointment {
  id: string;
  locationId: string;
  startsAt: string;
  endsAt: string;
  status: "booked" | "cancelled" | "completed" | "no_show";
  bookedBy: "agent" | "user" | "sync";
  service: string | null;
  resource: string | null;
  /** null: RLS no deja ver al contacto (contacts_select), aunque sí la cita. */
  contact: string | null;
}

/**
 * Las citas de cada día visible, en el día de su sede y por hora. Las que caen
 * fuera de los días visibles (lo que sobra de la ventana) no se enseñan.
 */
export function groupByDay(
  appointments: readonly CalendarAppointment[],
  days: readonly string[],
  zoneOf: (locationId: string) => string,
): Map<string, CalendarAppointment[]> {
  const byDay = new Map<string, CalendarAppointment[]>(days.map((day) => [day, []]));
  for (const appointment of appointments) {
    byDay.get(localDate(appointment.startsAt, zoneOf(appointment.locationId)))?.push(appointment);
  }
  for (const list of byDay.values()) {
    list.sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.id.localeCompare(b.id));
  }
  return byDay;
}

/** «10:00» en la zona de la sede, con la zona al lado si se pide. */
export function formatClock(iso: string, options: { locale: string; timeZone: string; withZone: boolean }): string {
  return new Intl.DateTimeFormat(options.locale, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: options.timeZone,
    ...(options.withZone ? { timeZoneName: "short" } : {}),
  }).format(new Date(iso));
}

/** El href de la agenda con esa vista y fecha, conservando el resto de parámetros (el alcance). */
export function calendarHref(base: string, params: URLSearchParams, view: CalendarView, date: string): string {
  const next = new URLSearchParams(params);
  next.set(VIEW_PARAM, view);
  next.set(DATE_PARAM, date);
  return `${base}?${next.toString()}`;
}
