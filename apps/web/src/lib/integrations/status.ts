// El estado que se enseña de una integración de plataforma (O-02). Una
// «pendiente» más vieja que una sesión de conexión de Nango (30 min) ya no
// puede terminar: se enseña como caducada, con «Volver a conectar» y
// «Desconectar», para que nunca quede atascada.

export type IntegrationStatus = "none" | "pending" | "expired" | "active" | "error" | "disconnected";

export const CONNECT_SESSION_TTL_MS = 30 * 60_000;

const KNOWN = new Set(["pending", "active", "error", "disconnected"]);

export function displayStatus(row: { status: string; updated_at: string } | undefined, now: Date): IntegrationStatus {
  if (!row || !KNOWN.has(row.status)) return "none";
  if (row.status === "pending" && now.getTime() - new Date(row.updated_at).getTime() > CONNECT_SESSION_TTL_MS) return "expired";
  return row.status as IntegrationStatus;
}
