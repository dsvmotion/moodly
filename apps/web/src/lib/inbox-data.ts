import "server-only";
import { createClient } from "@/lib/supabase/server";
import { locationsInScope, type Scope } from "@/lib/scope";
import type { ScopeContext } from "@/lib/scope-data";
import { idSchema } from "@/lib/validation";
import {
  ilikePattern,
  inScope,
  isConversationMode,
  isInboxChannel,
  isMessageAuthor,
  latestByConversation,
  modesFor,
  TEST_CHANNEL,
  THREAD_LIMIT,
  type ConversationMode,
  type InboxChannel,
  type InboxFilter,
  type MessageAuthor,
  type MessagePreview,
} from "./inbox";

// La bandeja de conversaciones (`/app/inbox`). Todo se lee con la sesión de la
// persona: RLS (conversations_select y las de contactos y mensajes) solo deja
// ver las conversaciones de los locales de su alcance, y las de toda la
// organización a un org_admin. Aquí solo se filtra por el selector de alcance,
// la pestaña y la búsqueda. La app no escribe nada en estas tablas.

/** Cuántas conversaciones trae la lista: las más recientes. */
export const LIST_LIMIT = 100;
// Tope de mensajes para sacar el último de cada conversación de la lista.
const PREVIEW_ROWS_LIMIT = 2000;

export interface InboxConversation {
  id: string;
  contactName: string | null;
  mode: ConversationMode;
  /** null: el canal no se sabe (hoy solo lo lee el org_admin) o no es uno de los conocidos. */
  channel: InboxChannel | null;
  locationId: string | null;
  location: string | null;
  agentKey: string | null;
  lastMessageAt: string | null;
  preview: MessagePreview | null;
}

export interface InboxMessage {
  id: string;
  author: MessageAuthor;
  content: string;
  status: string;
  createdAt: string;
}

export interface InboxThread {
  conversation: InboxConversation;
  messages: InboxMessage[];
  /** Hay mensajes más antiguos que los que se muestran. */
  truncated: boolean;
}

// Una sola cadena literal: así el cliente de Supabase deduce el tipo de cada fila.
const CONVERSATION_COLUMNS =
  "id, mode, location_id, last_message_at, created_at, contact:contacts!conversations_contact_same_org!inner(display_name), channel_account:channel_accounts!conversations_channel_account_same_org(channel), agent:agents!conversations_agent_same_org(type:agent_types(key))";

interface ConversationRow {
  id: string;
  mode: string;
  location_id: string | null;
  last_message_at: string | null;
  created_at: string;
  contact: { display_name: string | null } | null;
  channel_account: { channel: string } | null;
  agent: { type: { key: string } | null } | null;
}

function check<T>(result: { data: T; error: unknown }, what: string): T {
  if (result.error) throw new Error(`No se pudo cargar ${what}`, { cause: result.error });
  return result.data;
}

function toConversation(
  row: ConversationRow,
  names: ReadonlyMap<string, string>,
  preview: MessagePreview | null,
): InboxConversation | null {
  if (!isConversationMode(row.mode)) return null;
  // El chat de pruebas de cada persona no es un cliente: fuera de la bandeja.
  if (row.channel_account?.channel === TEST_CHANNEL) return null;
  const channel = row.channel_account?.channel;
  return {
    id: row.id,
    contactName: row.contact?.display_name ?? null,
    mode: row.mode,
    channel: isInboxChannel(channel) ? channel : null,
    locationId: row.location_id,
    location: row.location_id ? (names.get(row.location_id) ?? null) : null,
    agentKey: row.agent?.type?.key ?? null,
    lastMessageAt: row.last_message_at,
    preview,
  };
}

function scopeFilter(scope: Scope, context: ScopeContext) {
  const scoped = new Set(locationsInScope(scope, context.locations).map((location) => location.id));
  const names = new Map(context.locations.map((location) => [location.id, location.name]));
  return {
    accepts: (locationId: string | null) => inScope(locationId, scope, scoped),
    names,
  };
}

/** Las conversaciones de la pestaña, del alcance elegido, de la más reciente a la más antigua. */
export async function loadInboxConversations(input: {
  scope: Scope;
  context: ScopeContext;
  filter: InboxFilter;
  search: string;
}): Promise<InboxConversation[]> {
  const organization = input.context.organization;
  if (!organization) return [];
  const supabase = await createClient();
  let query = supabase
    .from("conversations")
    .select(CONVERSATION_COLUMNS)
    .eq("organization_id", organization.id)
    .in("mode", modesFor(input.filter))
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(LIST_LIMIT);
  if (input.search) query = query.ilike("contact.display_name", ilikePattern(input.search));
  const rows: ConversationRow[] = check(await query, "las conversaciones") ?? [];

  const { accepts, names } = scopeFilter(input.scope, input.context);
  const visible = rows.filter((row) => accepts(row.location_id));
  const previews = await loadPreviews(organization.id, visible);
  return visible.flatMap((row) => toConversation(row, names, previews.get(row.id) ?? null) ?? []);
}

/**
 * El último mensaje de cada conversación de la lista, en una sola consulta. El
 * último mensaje de cada una se escribió en su `last_message_at` (lo mantiene
 * la base de datos), así que basta con leer desde el más antiguo de esos.
 */
async function loadPreviews(organizationId: string, rows: readonly ConversationRow[]): Promise<Map<string, MessagePreview>> {
  const withMessages = rows.filter((row) => row.last_message_at !== null);
  if (withMessages.length === 0) return new Map();
  const since = withMessages.reduce(
    (oldest, row) => (row.last_message_at && row.last_message_at < oldest ? row.last_message_at : oldest),
    withMessages[0]?.last_message_at ?? "",
  );
  const supabase = await createClient();
  const messages = check(
    await supabase
      .from("messages")
      .select("conversation_id, author, content, created_at")
      .eq("organization_id", organizationId)
      .in(
        "conversation_id",
        withMessages.map((row) => row.id),
      )
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(PREVIEW_ROWS_LIMIT),
    "los últimos mensajes",
  );
  return latestByConversation(messages ?? []);
}

/**
 * Una conversación con sus últimos mensajes, o null si no existe, no se puede
 * ver (RLS), no entra en el alcance elegido o es del chat de pruebas.
 */
export async function loadInboxThread(input: { id: string; scope: Scope; context: ScopeContext }): Promise<InboxThread | null> {
  const organization = input.context.organization;
  if (!organization || !idSchema.safeParse(input.id).success) return null;
  const supabase = await createClient();
  const row: ConversationRow | null = check(
    await supabase
      .from("conversations")
      .select(CONVERSATION_COLUMNS)
      .eq("organization_id", organization.id)
      .eq("id", input.id)
      .maybeSingle(),
    "la conversación",
  );
  if (!row) return null;
  const { accepts, names } = scopeFilter(input.scope, input.context);
  if (!accepts(row.location_id)) return null;

  const rows =
    check(
      await supabase
        .from("messages")
        .select("id, author, content, status, created_at")
        .eq("organization_id", organization.id)
        .eq("conversation_id", row.id)
        .order("created_at", { ascending: false })
        .limit(THREAD_LIMIT + 1),
      "los mensajes",
    ) ?? [];
  const truncated = rows.length > THREAD_LIMIT;
  const messages = rows
    .slice(0, THREAD_LIMIT)
    .reverse()
    .flatMap((message): InboxMessage[] =>
      isMessageAuthor(message.author)
        ? [
            {
              id: message.id,
              author: message.author,
              content: message.content,
              status: message.status,
              createdAt: message.created_at,
            },
          ]
        : [],
    );
  const last = messages.at(-1);
  const conversation = toConversation(row, names, last ? { author: last.author, text: last.content } : null);
  return conversation ? { conversation, messages, truncated } : null;
}
