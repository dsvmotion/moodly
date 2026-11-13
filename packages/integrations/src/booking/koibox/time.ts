// La hora local del centro y UTC, sin librerías (Intl). Koibox da las fechas y
// horas en la zona del centro y no dice cuál es: la pone quien crea el lector,
// desde locations.timezone (nunca lo que diga el modelo).

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME = /^(\d{2}):(\d{2})(?::(\d{2}))?$/;

function parts(at: Date, timeZone: string) {
  const values: Record<string, number> = {};
  for (const part of new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at)) {
    if (part.type !== "literal") values[part.type] = Number(part.value);
  }
  return values as { year: number; month: number; day: number; hour: number; minute: number; second: number };
}

/** Lanza RangeError si la zona no existe (Intl la valida). */
export function assertTimeZone(timeZone: string): void {
  new Intl.DateTimeFormat("en-GB", { timeZone });
}

/** «AAAA-MM-DD» de ese instante en la zona. */
export function localDate(at: Date, timeZone: string): string {
  const p = parts(at, timeZone);
  return `${String(p.year).padStart(4, "0")}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/** «AAAA-MM-DDTHH:mm:ss» de ese instante en la zona, sin desfase. */
export function localDateTime(at: Date, timeZone: string): string {
  const p = parts(at, timeZone);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${localDate(at, timeZone)}T${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}`;
}

/** El día siguiente a una fecha «AAAA-MM-DD» (calendario, sin zona). */
export function nextDate(date: string): string {
  const m = DATE.exec(date);
  if (!m) throw new RangeError("fecha no válida");
  const next = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + 1));
  return next.toISOString().slice(0, 10);
}

/**
 * El instante de una fecha y hora locales de la zona, o null si no tienen
 * forma de fecha y hora. En el salto de hora de primavera, una hora que no
 * existe se adelanta (como hace Intl); en otoño, la primera de las dos.
 */
export function localToUtc(date: string, time: string, timeZone: string): Date | null {
  const d = DATE.exec(date);
  const t = TIME.exec(time);
  if (!d || !t) return null;
  const [y, mo, da, h, mi, s] = [Number(d[1]), Number(d[2]), Number(d[3]), Number(t[1]), Number(t[2]), Number(t[3] ?? "0")];
  if (mo < 1 || mo > 12 || da < 1 || da > 31 || h > 23 || mi > 59 || s > 59) return null;
  const wall = Date.UTC(y, mo - 1, da, h, mi, s);
  if (new Date(wall).getUTCDate() !== da) return null;
  // Dos pasadas: el desfase de la zona en esa hora (cambia con el horario de verano).
  let guess = wall;
  for (let i = 0; i < 2; i++) {
    const p = parts(new Date(guess), timeZone);
    const asIfUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    guess = wall - (asIfUtc - guess);
  }
  return new Date(guess);
}

/** «HH:mm:ss» o «HH:mm» (una duración de Koibox) en minutos, o null. */
export function durationMinutes(value: string | null | undefined): number | null {
  const t = TIME.exec(value ?? "");
  if (!t) return null;
  const minutes = Number(t[1]) * 60 + Number(t[2]) + Math.round(Number(t[3] ?? "0") / 60);
  return minutes > 0 && minutes <= 24 * 60 ? minutes : null;
}
