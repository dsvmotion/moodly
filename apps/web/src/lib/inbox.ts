// La bandeja de conversaciones (`/app/inbox`, MANUAL §9.4, patrones P2 + P3):
// lo puro de la pantalla, sin base de datos. Qué filtro se pidió, qué
// conversaciones entran en el alcance, el último mensaje de cada una y los
// enlaces que conservan el filtro, la búsqueda y el alcance.

import { withScope, type Scope } from "./scope";

export const CONVERSATION_MODES = ["agent", "human", "closed"] as const;
export type ConversationMode = (typeof CONVERSATION_MODES)[number];

export const MESSAGE_AUTHORS = ["contact", "agent", "user", "system"] as const;
export type MessageAuthor = (typeof MESSAGE_AUTHORS)[number];

/** Canales que la bandeja sabe nombrar. `test` (el chat de pruebas) nunca sale en la bandeja. */
export const INBOX_CHANNELS = ["whatsapp", "instagram", "email", "webchat", "voice"] as const;
export type InboxChannel = (typeof INBOX_CHANNELS)[number];
export const TEST_CHANNEL = "test";

/**
 * Canales por los que lo que escribe el equipo llega de verdad al cliente. Hoy
 * solo el chat web: el widget lee el mensaje de la conversación. Por los demás
 * no hay quien lo envíe hasta la capa de canales (auditoría de preproducción,
 * O-01), y el mensaje se quedaría «pendiente» para siempre (M-01). Se añade aquí
 * cada canal cuando tenga su envío.
 */
export const REPLY_CHANNELS: readonly InboxChannel[] = ["webchat"];

/** ¿Puede escribir el equipo al cliente por este canal desde la bandeja? */
export function canReplyOn(channel: string | null | undefined): boolean {
  return typeof channel === "string" && (REPLY_CHANNELS as readonly string[]).includes(channel);
}

/** Las pestañas de la bandeja: abiertas (las lleva el agente o el equipo), las del equipo y las cerradas. */
export const INBOX_FILTERS = ["open", "human", "closed"] as const;
export type InboxFilter = (typeof INBOX_FILTERS)[number];
export const DEFAULT_INBOX_FILTER: InboxFilter = "open";

export const STATUS_PARAM = "status";
export const SEARCH_PARAM = "q";
export const SEARCH_MAX_LENGTH = 100;
/** La página de la lista: lo anterior a esta posición (un cursor, ver `encodeCursor`). */
export const BEFORE_PARAM = "before";
/** Cuántos mensajes enseña el hilo: los últimos. */
export const THREAD_LIMIT = 200;

// La base de datos ya los restringe (CHECK); esto lo comprueba al leer para que
// TypeScript no tenga que fiarse.
export function isConversationMode(value: string): value is ConversationMode {
  return (CONVERSATION_MODES as readonly string[]).includes(value);
}
export function isMessageAuthor(value: string): value is MessageAuthor {
  return (MESSAGE_AUTHORS as readonly string[]).includes(value);
}
export function isInboxChannel(value: string | null | undefined): value is InboxChannel {
  return typeof value === "string" && (INBOX_CHANNELS as readonly string[]).includes(value);
}

/** Un parámetro de la URL: el primero si viene repetido. */
function single(value: unknown): string | undefined {
  if (Array.isArray(value)) return single(value[0]);
  return typeof value === "string" ? value : undefined;
}

export function parseInboxFilter(value: unknown): InboxFilter {
  const raw = single(value);
  return (INBOX_FILTERS as readonly string[]).includes(raw ?? "") ? (raw as InboxFilter) : DEFAULT_INBOX_FILTER;
}

/** El texto de búsqueda, sin espacios de sobra y con un tope de longitud. Vacío: sin búsqueda. */
export function parseSearch(value: unknown): string {
  return (single(value) ?? "").replace(/\s+/g, " ").trim().slice(0, SEARCH_MAX_LENGTH);
}

/** Los modos de conversación de cada pestaña. */
export function modesFor(filter: InboxFilter): ConversationMode[] {
  if (filter === "human") return ["human"];
  if (filter === "closed") return ["closed"];
  return ["agent", "human"];
}

/**
 * Patrón para `ilike` que busca el texto tal cual: escapa los comodines de
 * LIKE (`%`, `_`) y la barra invertida, para que «50%» no sea «50 y lo que sea».
 */
export function ilikePattern(search: string): string {
  return `%${search.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

/**
 * ¿Entra en el alcance elegido? Lo de un local, si el local está en el alcance;
 * lo de toda la organización (sin local), solo con «Toda la organización».
 * RLS ya decide qué se puede ver: esto solo filtra por el selector.
 */
export function inScope(locationId: string | null, scope: Scope, scopedLocationIds: ReadonlySet<string>): boolean {
  return locationId === null ? scope.kind === "all" : scopedLocationIds.has(locationId);
}

export interface PreviewSource {
  conversation_id: string;
  author: string;
  content: string;
  created_at: string;
}

export interface MessagePreview {
  author: MessageAuthor;
  text: string;
}

export const PREVIEW_MAX_LENGTH = 120;

/** Una línea del mensaje: sin saltos ni espacios repetidos y cortada con «…». */
export function previewText(content: string, max = PREVIEW_MAX_LENGTH): string {
  const flat = content.replace(/\s+/g, " ").trim();
  return flat.length <= max ? flat : `${flat.slice(0, max - 1).trimEnd()}…`;
}

/** El último mensaje de cada conversación, de una lista de mensajes de varias. */
export function latestByConversation(messages: readonly PreviewSource[]): Map<string, MessagePreview> {
  const latest = new Map<string, PreviewSource>();
  for (const message of messages) {
    const current = latest.get(message.conversation_id);
    if (!current || Date.parse(message.created_at) > Date.parse(current.created_at)) {
      latest.set(message.conversation_id, message);
    }
  }
  const previews = new Map<string, MessagePreview>();
  for (const [conversationId, message] of latest) {
    if (!isMessageAuthor(message.author)) continue;
    previews.set(conversationId, {
      author: message.author,
      text: previewText(message.content),
    });
  }
  return previews;
}

/** Dónde va cada mensaje en el hilo: el cliente a un lado, el negocio al otro y el sistema en medio. */
export function messageSide(author: MessageAuthor): "start" | "end" | "center" {
  if (author === "contact") return "start";
  if (author === "system") return "center";
  return "end";
}

/**
 * La posición de una conversación en la lista. La lista va de la más reciente a
 * la más antigua por su último mensaje; las que no tienen mensajes, al final; y
 * a igualdad, por creación y por id. Con esos tres datos se pide «lo anterior a
 * esta fila» sin contar páginas: un mensaje nuevo, que reordena la lista, no
 * repite ni se salta conversaciones (auditoría de preproducción, M-07).
 */
export interface InboxCursor {
  lastMessageAt: string | null;
  createdAt: string;
  id: string;
}

const CURSOR_SEPARATOR = "~";
// Lo que devuelve la base de datos para una fecha y para un id. Estrictos: el
// cursor viene de la URL y acaba dentro de un filtro de la consulta.
const CURSOR_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/;
const CURSOR_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function encodeCursor(cursor: InboxCursor): string {
  return [cursor.lastMessageAt ?? "", cursor.createdAt, cursor.id].join(CURSOR_SEPARATOR);
}

/** El cursor de `?before=`, o null si falta o no tiene la forma exacta: la lista empieza entonces por el principio. */
export function parseCursor(value: unknown): InboxCursor | null {
  const parts = (single(value) ?? "").split(CURSOR_SEPARATOR);
  if (parts.length !== 3) return null;
  const [lastMessageAt = "", createdAt = "", id = ""] = parts;
  if (lastMessageAt !== "" && !CURSOR_TIMESTAMP.test(lastMessageAt)) return null;
  if (!CURSOR_TIMESTAMP.test(createdAt) || !CURSOR_ID.test(id)) return null;
  return { lastMessageAt: lastMessageAt === "" ? null : lastMessageAt, createdAt, id };
}

/**
 * «Más antiguas que el cursor», como filtro de PostgREST sobre `conversations`
 * (para `.or()`), en el mismo orden que la lista. Si la del cursor no tiene
 * mensajes, lo anterior son solo otras sin mensajes (`onlyWithoutMessages`).
 */
export function olderThan(cursor: InboxCursor): { onlyWithoutMessages: boolean; or: string } {
  const created = `"${cursor.createdAt}"`;
  const tie = `created_at.lt.${created},and(created_at.eq.${created},id.lt.${cursor.id})`;
  if (cursor.lastMessageAt === null) return { onlyWithoutMessages: true, or: tie };
  const last = `"${cursor.lastMessageAt}"`;
  return {
    onlyWithoutMessages: false,
    or: `last_message_at.lt.${last},last_message_at.is.null,and(last_message_at.eq.${last},or(${tie}))`,
  };
}

export interface InboxQuery {
  filter: InboxFilter;
  search: string;
  /** Valor del selector de alcance (`scopeValue`), o null. */
  scope: string | null;
  /** La página: el cursor de `?before=` ya validado, o nada si es la primera. */
  before?: string | null;
}

/** El enlace a la bandeja o a una conversación, con el filtro, la búsqueda, la página y el alcance de ahora. */
export function inboxHref(query: InboxQuery, conversationId?: string): string {
  const params = new URLSearchParams();
  if (query.filter !== DEFAULT_INBOX_FILTER) params.set(STATUS_PARAM, query.filter);
  if (query.search) params.set(SEARCH_PARAM, query.search);
  if (query.before) params.set(BEFORE_PARAM, query.before);
  const search = params.toString();
  const path = conversationId ? `/app/inbox/${encodeURIComponent(conversationId)}` : "/app/inbox";
  return withScope(search ? `${path}?${search}` : path, query.scope);
}

/** Lo más largo que el equipo puede escribir en un mensaje (el mismo tope que la base de datos). */
export const MESSAGE_MAX_LENGTH = 10_000;

export const INBOX_ACTION_ERRORS = ["invalid", "not_allowed", "channel_unavailable", "failed"] as const;
export type InboxActionError = (typeof INBOX_ACTION_ERRORS)[number];

/**
 * Qué decirle a la persona cuando la base de datos rechaza tomar el control,
 * devolverlo o escribir: sin permiso o en un estado que no lo admite (42501, la
 * RLS o las guardas), un mensaje vacío (23514) o un fallo nuestro.
 */
export function inboxErrorFor(code: string | undefined): InboxActionError {
  if (code === "42501") return "not_allowed";
  if (code === "23514") return "invalid";
  return "failed";
}
