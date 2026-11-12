import type { MembershipRole } from "./scope";

// La bandeja en vivo (auditoría M-10, ADR 0054). La base de datos avisa de cada
// alta o cambio de mensajes y conversaciones con un Broadcast privado de
// Realtime al tema de su bandeja (#216). El navegador no habla con Supabase
// (cookies httpOnly y connect-src 'self', R-29): lo escucha el servidor de la
// app, con la sesión de la persona, y reenvía al navegador por Server-Sent
// Events solo identificadores; el navegador vuelve a leer la página con su
// sesión (RLS). Lógica pura; la ruta está en app/app/inbox/events/route.ts.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Cuánto vive una conexión: por debajo del maxDuration de la ruta (300 s). Al cerrarla, el navegador vuelve a conectar y se comprueba otra vez la sesión y el alcance. */
export const STREAM_MAX_MS = 270_000;
/** Un comentario cada tanto, para que ningún proxy dé la conexión por muerta. */
export const HEARTBEAT_MS = 25_000;
/** Aunque no llegue ningún aviso (realtime.send no corta si falla), la página se vuelve a pedir cada tanto. */
export const FALLBACK_REFRESH_MS = 60_000;
/** Un mensaje suele traer también un aviso de su conversación: se juntan en una sola relectura. */
export const COALESCE_MS = 300;
/** Cuánto espera EventSource para volver a conectar tras un cierre. */
export const RECONNECT_MS = 2_000;

export const LIVE_EVENTS = ["message", "conversation"] as const;
export type LiveEventType = (typeof LIVE_EVENTS)[number];

export interface LiveEvent {
  type: LiveEventType;
  conversationId: string;
  messageId?: string;
}

/**
 * Los temas que escucha la persona: los de cada local que ve y, si es
 * org_admin, el de toda la organización (lo mismo que deja leer la política
 * inbox_read: can_see_scope). Salen del alcance real de la sesión, leído en el
 * servidor, nunca de la petición.
 */
export function inboxTopics({
  organizationId,
  role,
  locationIds,
}: {
  organizationId: string | null;
  role: MembershipRole | null;
  locationIds: readonly string[];
}): string[] {
  if (!organizationId || !role || !UUID.test(organizationId)) return [];
  const locations = [...new Set(locationIds.filter((id) => UUID.test(id)))].sort();
  const topics = locations.map((id) => `inbox:${organizationId}:${id}`);
  if (role === "org_admin") topics.push(`inbox:${organizationId}:org`);
  return topics;
}

/**
 * Lo que se reenvía de un aviso: el tipo y los identificadores, validados. El
 * resto de la carga no sale del servidor, y un aviso que no es de la bandeja
 * no se reenvía.
 */
export function liveEvent(event: string, payload: unknown): LiveEvent | null {
  if (!(LIVE_EVENTS as readonly string[]).includes(event)) return null;
  if (typeof payload !== "object" || payload === null) return null;
  const { conversation_id: conversationId, message_id: messageId } = payload as Record<string, unknown>;
  if (typeof conversationId !== "string" || !UUID.test(conversationId)) return null;
  const result: LiveEvent = { type: event as LiveEventType, conversationId };
  if (typeof messageId === "string" && UUID.test(messageId)) result.messageId = messageId;
  return result;
}

/** Un evento de Server-Sent Events, con los datos en JSON en una sola línea. */
export function sseMessage(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}
