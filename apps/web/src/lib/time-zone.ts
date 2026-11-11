// Las horas en la zona horaria del local (auditoría de preproducción, M-08).
// Decisión de producto del 2026-11-10: cada hora va en la zona de su local, con
// la zona escrita al lado cuando la organización tiene más de una o cuando quien
// mira está en otra zona. Lógica pura: qué zona toca, si se escribe y cómo.

import { locationsInScope, type Scope, type VisibleLocation } from "./scope";

/** La de `locations.timezone` por defecto en la base de datos. */
export const DEFAULT_TIME_ZONE = "Europe/Madrid";

export interface ZonedLocation extends VisibleLocation {
  timeZone: string;
}

/**
 * La zona tal cual si `Intl` la conoce; si no, la de por defecto. La base de
 * datos no comprueba `locations.timezone`, y una zona inválida haría fallar el
 * formato de todas las horas de la pantalla.
 */
export function validTimeZone(value: unknown): string {
  if (typeof value !== "string" || value === "") return DEFAULT_TIME_ZONE;
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return value;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, "es");

/**
 * La zona de algo de un local: la de su local. Lo que no tiene local (lo de toda
 * la organización) va en la del local elegido en el selector; con una región o
 * con toda la organización, en la del primer local por nombre.
 */
export function zoneForLocation(locationId: string | null, scope: Scope, locations: readonly ZonedLocation[]): string {
  if (locationId !== null) return locations.find((location) => location.id === locationId)?.timeZone ?? DEFAULT_TIME_ZONE;
  const [first] = [...locationsInScope(scope, locations)].sort(byName);
  return first?.timeZone ?? DEFAULT_TIME_ZONE;
}

/** ¿Hay más de una zona entre los locales que ve la persona? Entonces cada hora lleva su zona. */
export function needsZoneLabel(locations: readonly ZonedLocation[]): boolean {
  return new Set(locations.map((location) => location.timeZone)).size > 1;
}

/** Fecha y hora cortas en esa zona, con la zona al lado si se pide («10/11/26, 10:30 CET»). */
export function formatLocalTime(iso: string, options: { locale: string; timeZone: string; withZone: boolean }): string {
  return new Intl.DateTimeFormat(options.locale, {
    day: "numeric",
    month: "numeric",
    year: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    timeZone: options.timeZone,
    ...(options.withZone ? { timeZoneName: "short" } : {}),
  }).format(new Date(iso));
}
