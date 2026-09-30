/**
 * Texto de un contador de la barra lateral (pendientes). Sin valor o con 0 no
 * se muestra nada: nunca se inventan pendientes. Por encima de 99, "99+".
 */
export function formatCount(value: number | null | undefined): string | null {
  if (value === null || value === undefined || !Number.isFinite(value) || value <= 0) return null;
  return value > 99 ? "99+" : String(Math.floor(value));
}
