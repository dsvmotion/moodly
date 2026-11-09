import { AUTONOMY_LEVELS, EFFECT_CLASSES } from "@repo/agent-core";
import type { AutonomyLevel } from "@repo/agent-core";
import type { TenantDb } from "@repo/db/service";
import { z } from "zod";
import { APPROVAL_TTL_MS } from "../agents/approvals.ts";

// Aceptar la oferta de la lista de espera contestando SÍ (paso 4f-3, MANUAL
// §5.1, decidido por producto el 2026-11-08).
//
// - Si el mensaje de un cliente es un «sí» corto y tiene una oferta viva en esa
//   conversación, agent.converse no llama al modelo: propone él mismo
//   book_appointment con el hueco de la oferta (servicio, recurso y hora: nunca
//   del LLM), por el motor de políticas y con la autonomía del agente. De serie
//   queda en borrador y va a la bandeja de aprobaciones como cualquier otra
//   reserva; con execute, se reserva ya.
// - Mientras la reserva espera a una persona, la oferta se alarga hasta que
//   caduca la aprobación (o hasta que empieza el hueco, si es antes): nadie más
//   ve el hueco y el workflow de la oferta sigue esperando. Si se aprueba, la
//   cita cierra la oferta; si se rechaza, la oferta se acaba y el hueco pasa al
//   siguiente (waitlist/offers.ts).
// - Contesta con un texto fijo en el idioma del contacto.

export const BOOK_SKILL_KEY = "book_appointment";
const ACCEPT_PREFIX = "waitlist-accept:";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** La clave de la reserva que sale de aceptar una oferta: la de su ejecución y la de su cita. */
export function acceptanceKey(entryId: string, messageId: string): string {
  return `${ACCEPT_PREFIX}${entryId}:${messageId}`;
}

/** La entrada de la lista cuya oferta aceptó una reserva, si esa ejecución lo es. */
export function acceptedEntry(skillKey: string, idempotencyKey: string): string | null {
  if (skillKey !== BOOK_SKILL_KEY || !idempotencyKey.startsWith(ACCEPT_PREFIX)) return null;
  const entryId = idempotencyKey.slice(ACCEPT_PREFIX.length).split(":")[0] ?? "";
  return UUID.test(entryId) ? entryId : null;
}

const YES = new Set(["si", "yes", "vale", "ok", "okay", "claro", "de acuerdo", "si por favor", "yes please", "lo quiero", "si lo quiero", "sure"]);

/** Si el mensaje es un «sí» corto (sin importar mayúsculas, tildes ni signos). Una frase más larga no cuenta: la contesta el agente. */
export function isYes(content: string): boolean {
  const normalized = content
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
  return YES.has(normalized);
}

export type AcceptanceOutcome = "pending" | "booked" | "failed";

/** La respuesta al «sí», en el idioma del contacto (o el de la organización); en inglés si no es español. */
export function acceptanceText(
  outcome: AcceptanceOutcome,
  offer: { service: string; location: string; timezone: string; locale: string; startsAt: Date },
): string {
  const es = offer.locale.toLowerCase().startsWith("es");
  const when = new Intl.DateTimeFormat(es ? "es-ES" : "en-GB", {
    timeZone: offer.timezone,
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(offer.startsAt);
  if (outcome === "booked") {
    return es
      ? `¡Hecho! Tienes cita de ${offer.service} en ${offer.location} el ${when}.`
      : `Done! You're booked for ${offer.service} at ${offer.location} on ${when}.`;
  }
  if (outcome === "pending") {
    return es
      ? `¡Genial! Te guardamos el hueco del ${when} y el equipo te lo confirma enseguida.`
      : `Great! We're holding the ${when} slot for you and the team will confirm it shortly.`;
  }
  return es
    ? "Vaya, no hemos podido reservarlo. Una persona del equipo te escribe enseguida."
    : "Sorry, we couldn't book it. Someone from the team will get back to you shortly.";
}

/** Hasta cuándo se guarda el hueco mientras la reserva espera a una persona: lo que dura la aprobación, y nunca más allá del hueco. */
export function holdUntil(now: Date, slotStartsAt: Date): Date {
  return new Date(Math.min(now.getTime() + APPROVAL_TTL_MS, slotStartsAt.getTime()));
}

function check<T>(result: { data: T; error: { code: string } | null }, what: string): T {
  if (result.error) throw new Error(`no se pudo leer ${what} (${result.error.code})`);
  return result.data;
}

const contextSchema = z.object({
  agent: z.object({ status: z.string() }),
  organization: z.object({ default_locale: z.string() }),
  skills: z.array(
    z.object({
      key: z.string(),
      version: z.number().int(),
      kind: z.string(),
      effect_class: z.enum(EFFECT_CLASSES),
      enabled: z.boolean(),
      autonomy_level: z.enum(AUTONOMY_LEVELS),
    }),
  ),
});

/** Lo que hace falta para aceptar. Serializable: es el resultado de un paso. */
export type Acceptance =
  | { kind: "none" }
  | {
      kind: "accept";
      entryId: string;
      serviceId: string;
      resourceId: string;
      startsAt: string;
      expiresAt: string;
      conversation: { id: string; locationId: string | null; contactId: string; agentId: string };
      agentStatus: string;
      channel: string | null;
      /** book_appointment tal como la tiene configurada el agente. */
      book: { version: number; kind: string; effectClass: string; enabled: boolean; autonomy: AutonomyLevel } | null;
      text: { service: string; location: string; timezone: string; locale: string };
    };

/** Si este mensaje acepta una oferta viva de la lista de espera en su conversación. */
export async function findAcceptance(db: TenantDb, conversationId: string, messageId: string, now: Date): Promise<Acceptance> {
  const message = check(
    await db.from("messages").select("content, author").eq("id", messageId).eq("conversation_id", conversationId).maybeSingle(),
    "el mensaje",
  );
  if (!message || message.author !== "contact" || !isYes(message.content)) return { kind: "none" };
  const conversation = check(
    await db.from("conversations").select("id, location_id, contact_id, agent_id, mode, channel_account_id").eq("id", conversationId).maybeSingle(),
    "la conversación",
  );
  // Con la conversación en manos de una persona, el «sí» lo atiende ella.
  if (!conversation || conversation.mode !== "agent") return { kind: "none" };
  const entry = check(
    await db
      .from("waitlist_entries")
      .select("id, service_id, location_id, offered_resource_id, offered_starts_at, offer_expires_at")
      .eq("conversation_id", conversationId)
      .eq("contact_id", conversation.contact_id)
      .eq("status", "offered")
      .gt("offer_expires_at", now.toISOString())
      .order("offer_expires_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    "la oferta",
  );
  if (!entry?.offered_resource_id || !entry.offered_starts_at || !entry.offer_expires_at) return { kind: "none" };

  const raw = await db.agentTurnContext(conversation.agent_id);
  if (!raw) return { kind: "none" };
  const context = contextSchema.parse(raw);
  const row = context.skills.find((skill) => skill.key === BOOK_SKILL_KEY);
  const [account, service, location, contact] = await Promise.all([
    db.from("channel_accounts").select("channel").eq("id", conversation.channel_account_id).maybeSingle(),
    db.from("services").select("name").eq("id", entry.service_id).maybeSingle(),
    db.from("locations").select("name, timezone").eq("id", entry.location_id).maybeSingle(),
    db.from("contacts").select("locale").eq("id", conversation.contact_id).maybeSingle(),
  ]);
  return {
    kind: "accept",
    entryId: entry.id,
    serviceId: entry.service_id,
    resourceId: entry.offered_resource_id,
    startsAt: new Date(entry.offered_starts_at).toISOString(),
    expiresAt: new Date(entry.offer_expires_at).toISOString(),
    conversation: { id: conversation.id, locationId: conversation.location_id, contactId: conversation.contact_id, agentId: conversation.agent_id },
    agentStatus: context.agent.status,
    channel: check(account, "el canal")?.channel ?? null,
    book: row ? { version: row.version, kind: row.kind, effectClass: row.effect_class, enabled: row.enabled, autonomy: row.autonomy_level } : null,
    text: {
      service: check(service, "el servicio")?.name ?? "",
      location: check(location, "el local")?.name ?? "",
      timezone: check(location, "el local")?.timezone ?? "UTC",
      locale: check(contact, "el contacto")?.locale ?? context.organization.default_locale,
    },
  };
}

/** Alarga la oferta mientras la reserva espera a una persona, solo si sigue siendo esta. */
export async function holdOffer(db: TenantDb, entryId: string, expiresAt: string, until: Date): Promise<boolean> {
  const { data, error } = await db
    .from("waitlist_entries")
    .update({ offer_expires_at: until.toISOString() })
    .eq("id", entryId)
    .eq("status", "offered")
    .eq("offer_expires_at", expiresAt)
    .select("id");
  if (error) throw new Error(`no se pudo guardar el hueco (${error.code})`);
  return (data ?? []).length > 0;
}
