import type { Json } from "@repo/db";
import type { TenantDb } from "@repo/db/service";
import { createConversationSender } from "../agents/conversation-sender.ts";

// El permiso para los recordatorios y la baja contestando (pasos 4e-2 y 4e-3,
// MANUAL §5.1, decidido por producto el 2026-11-08).
//
// - Reservar a través del agente es el permiso para los recordatorios de esa
//   cita. Quien contesta solo «BAJA» o «STOP» se da de baja: queda en
//   contacts.consents.appointment_reminders.opted_out_at y ya no recibe
//   ninguno, tampoco de las citas que reserve después.
// - La baja se atiende antes que el turno del agente y aunque la conversación
//   esté con una persona: no llama al modelo y contesta con un texto fijo.

/** Clave en contacts.consents de la baja de los recordatorios. */
export const REMINDER_CONSENT_KEY = "appointment_reminders";

/** Si el contacto se dio de baja de los recordatorios. */
export function optedOut(consents: unknown): boolean {
  if (typeof consents !== "object" || consents === null) return false;
  const entry = (consents as Record<string, unknown>)[REMINDER_CONSENT_KEY];
  return typeof entry === "object" && entry !== null && typeof (entry as Record<string, unknown>)["opted_out_at"] === "string";
}

const OPT_OUT_WORDS = new Set(["baja", "stop"]);

/** Si el mensaje es solo BAJA o STOP (sin importar mayúsculas, tildes ni signos). Una frase que la nombra no cuenta. */
export function isOptOut(content: string): boolean {
  const normalized = content
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
  return OPT_OUT_WORDS.has(normalized);
}

const CONFIRMATION = {
  es: "Hecho: ya no te enviaremos recordatorios de tus citas.",
  en: "Done: we won't send you appointment reminders any more.",
} as const;

/** La respuesta a la baja, en el idioma del contacto (o el de la organización); en inglés si no es español. */
export function optOutConfirmation(locale: string): string {
  return locale.toLowerCase().startsWith("es") ? CONFIRMATION.es : CONFIRMATION.en;
}

/** La clave del mensaje que confirma la baja: uno por mensaje del cliente. */
export function optOutKey(messageId: string): string {
  return `opt-out:${messageId}`;
}

function check<T>(result: { data: T; error: { code: string } | null }, what: string): T {
  if (result.error) throw new Error(`no se pudo leer ${what} (${result.error.code})`);
  return result.data;
}

export type OptOutResult = { handled: false } | { handled: true; alreadyOptedOut: boolean };

/**
 * Si el mensaje de un cliente es una baja, la registra y la confirma por la
 * misma conversación. Idempotente: se puede repetir entero (la baja no se
 * vuelve a fechar y la confirmación va con la clave del mensaje).
 */
export async function handleOptOut(db: TenantDb, conversationId: string, messageId: string, now: Date): Promise<OptOutResult> {
  const message = check(
    await db.from("messages").select("content, author").eq("id", messageId).eq("conversation_id", conversationId).maybeSingle(),
    "el mensaje",
  );
  if (!message || message.author !== "contact" || !isOptOut(message.content)) return { handled: false };
  const conversation = check(await db.from("conversations").select("contact_id, agent_id").eq("id", conversationId).maybeSingle(), "la conversación");
  if (!conversation) return { handled: false };
  const contact = check(await db.from("contacts").select("consents, locale").eq("id", conversation.contact_id).maybeSingle(), "el contacto");
  if (!contact) return { handled: false };

  const alreadyOptedOut = optedOut(contact.consents);
  if (!alreadyOptedOut) {
    const current = typeof contact.consents === "object" && contact.consents !== null && !Array.isArray(contact.consents) ? contact.consents : {};
    const consents = { ...current, [REMINDER_CONSENT_KEY]: { opted_out_at: now.toISOString(), via: "reply", conversation_id: conversationId } };
    const { error } = await db.from("contacts").update({ consents: consents as NonNullable<Json> }).eq("id", conversation.contact_id);
    if (error) throw new Error(`no se pudo registrar la baja (${error.code})`);
  }

  const locale = contact.locale ?? ((await db.agentTurnContext(conversation.agent_id)) as { organization?: { default_locale?: string } } | null)?.organization?.default_locale ?? "en";
  await createConversationSender(db).send({ conversationId, text: optOutConfirmation(locale), idempotencyKey: optOutKey(messageId) });
  return { handled: true, alreadyOptedOut };
}
