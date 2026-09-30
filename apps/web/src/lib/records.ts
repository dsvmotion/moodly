// Utilidades de las vistas de registros (P2 + P4). Lógica pura, probada aparte.

export const RECORD_PARAM = "record";

/** Añade o quita ?record= conservando el resto de parámetros (p. ej. ?scope=). */
export function withRecord(href: string, id: string | null): string {
  const [path = "", query = ""] = href.split("?");
  const params = new URLSearchParams(query);
  if (id) params.set(RECORD_PARAM, id);
  else params.delete(RECORD_PARAM);
  const search = params.toString();
  return search ? `${path}?${search}` : path;
}

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

/**
 * Resumen legible del horario (opening_hours jsonb: { mon: ["09:00","20:00"], … }).
 * Devuelve null si no hay horario definido. Ignora entradas mal formadas.
 */
export function summarizeOpeningHours(value: unknown, dayLabels: Record<(typeof DAYS)[number], string>): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const hours = value as Record<string, unknown>;
  const parts = DAYS.flatMap((day) => {
    const range = hours[day];
    if (!Array.isArray(range) || range.length !== 2 || !range.every((t) => typeof t === "string" && /^\d{2}:\d{2}$/.test(t))) {
      return [];
    }
    return [`${dayLabels[day]} ${range[0]}–${range[1]}`];
  });
  return parts.length > 0 ? parts.join(" · ") : null;
}
