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

/** Las pestañas de la bandeja: abiertas (las lleva el agente o el equipo), las del equipo y las cerradas. */
export const INBOX_FILTERS = ["open", "human", "closed"] as const;
export type InboxFilter = (typeof INBOX_FILTERS)[number];
export const DEFAULT_INBOX_FILTER: InboxFilter = "open";

export const STATUS_PARAM = "status";
export const SEARCH_PARAM = "q";
export const SEARCH_MAX_LENGTH = 100;
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

export interface InboxQuery {
  filter: InboxFilter;
  search: string;
  /** Valor del selector de alcance (`scopeValue`), o null. */
  scope: string | null;
}

/** El enlace a la bandeja o a una conversación, con el filtro, la búsqueda y el alcance de ahora. */
export function inboxHref(query: InboxQuery, conversationId?: string): string {
  const params = new URLSearchParams();
  if (query.filter !== DEFAULT_INBOX_FILTER) params.set(STATUS_PARAM, query.filter);
  if (query.search) params.set(SEARCH_PARAM, query.search);
  const search = params.toString();
  const path = conversationId ? `/app/inbox/${encodeURIComponent(conversationId)}` : "/app/inbox";
  return withScope(search ? `${path}?${search}` : path, query.scope);
}

/** Lo más largo que el equipo puede escribir en un mensaje (el mismo tope que la base de datos). */
export const MESSAGE_MAX_LENGTH = 10_000;

export const INBOX_ACTION_ERRORS = ["invalid", "not_allowed", "failed"] as const;
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
