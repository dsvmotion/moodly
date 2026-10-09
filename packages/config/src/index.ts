// Configuración compartida (MANUAL §3.3). La marca está en revisión legal
// (MANUAL §18 #1): el código usa siempre BRAND_NAME, nunca el nombre a mano.
export const BRAND_NAME = "Moodly";

/**
 * Tipos de agente canónicos (MANUAL §5). Fuente única para `apps/web` y el
 * backend (`agent_types`): clave estable en inglés (BD/API), nombre por defecto
 * en español y token de color de marca (ver packages/ui, `--agent-*`).
 *
 * Resuelve la inconsistencia de la auditoría 2026-10-09: el prototipo usaba
 * claves en español (recepcion/atencion/comercial/administracion) y el MANUAL
 * mencionaba customer/sales/operations/admin. Se fija aquí una sola, alineada
 * con los tokens de color confirmados.
 */
export const AGENT_TYPES = [
  { key: "reception", name: "Recepción", color: "agent-reception" },
  { key: "customer", name: "Atención al cliente", color: "agent-customer" },
  { key: "sales", name: "Comercial", color: "agent-sales" },
  { key: "admin", name: "Administración", color: "agent-admin" },
] as const;

export type AgentTypeKey = (typeof AGENT_TYPES)[number]["key"];
