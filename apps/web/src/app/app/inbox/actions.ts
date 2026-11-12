"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Database } from "@repo/db";
import { requireUser } from "@/lib/auth/session";
import { canReplyOn, inboxErrorFor, MESSAGE_MAX_LENGTH, type InboxActionError } from "@/lib/inbox";
import { logger, securityEvent } from "@/lib/observability/logger";
import { createClient } from "@/lib/supabase/server";
import { idSchema } from "@/lib/validation";

// Tomar el control de una conversación, devolverla al agente y escribir como
// equipo (MANUAL §5.9). La barrera es la base de datos (20261109230000_inbox_takeover):
// - conversations_takeover deja cambiar `mode` a quien ve la conversación (el
//   org_admin, con aal2) y guard_conversation_mode solo admite agent ↔ human y
//   pone quién la lleva;
// - messages_insert_staff deja escribir solo en una conversación que lleva una
//   persona, y guard_staff_message pone el autor, el sentido y el estado.
// Aquí solo se valida la forma, se traduce el error y se deja el evento.

type MessageInsert = Database["public"]["Tables"]["messages"]["Insert"];
type StaffMessageInsert = Pick<MessageInsert, "organization_id" | "conversation_id" | "content">;

const modeSchema = z.object({ id: idSchema, mode: z.enum(["agent", "human"]) });
const messageSchema = z.object({ id: idSchema, content: z.string().trim().min(1).max(MESSAGE_MAX_LENGTH) });

export interface InboxActionState {
  error: InboxActionError | null;
  /** Cambia en cada acción correcta: el formulario se vacía. */
  doneAt: number | null;
}

/** Tomar el control (`human`) o devolverlo al agente (`agent`). */
export async function setConversationMode(_prev: InboxActionState, formData: FormData): Promise<InboxActionState> {
  const user = await requireUser();
  const parsed = modeSchema.safeParse({ id: formData.get("id"), mode: formData.get("mode") });
  if (!parsed.success) return { error: "invalid", doneAt: null };
  const { id, mode } = parsed.data;

  const supabase = await createClient();
  // Solo desde el modo contrario: tomar una que ya lleva alguien, o devolver una
  // que ya lleva el agente, no hace nada (y lo dice).
  const { data, error } = await supabase
    .from("conversations")
    .update({ mode })
    .eq("id", id)
    .eq("mode", mode === "human" ? "agent" : "human")
    .select("organization_id");
  if (error) {
    const reason = inboxErrorFor(error.code);
    if (reason === "failed")
      logger.error({ userId: user.id, conversationId: id, code: error.code }, "no se pudo cambiar quién lleva la conversación");
    return { error: reason, doneAt: null };
  }
  // Sin fila: no la ve (RLS), le falta aal2 o ya no estaba en el modo de partida.
  const changed = data[0];
  if (!changed) return { error: "not_allowed", doneAt: null };

  securityEvent(mode === "human" ? "inbox.conversation_taken_over" : "inbox.conversation_handed_back", {
    userId: user.id,
    organizationId: changed.organization_id,
    conversationId: id,
  });
  revalidatePath("/app/inbox", "layout");
  return { error: null, doneAt: Date.now() };
}

/** Escribir al cliente como equipo, en una conversación que lleva una persona. */
export async function sendStaffMessage(_prev: InboxActionState, formData: FormData): Promise<InboxActionState> {
  const user = await requireUser();
  const parsed = messageSchema.safeParse({ id: formData.get("id"), content: formData.get("content") });
  if (!parsed.success) return { error: "invalid", doneAt: null };
  const { id, content } = parsed.data;

  const supabase = await createClient();
  // La organización sale de la conversación (leída con RLS), nunca del formulario.
  const { data: conversation, error: readError } = await supabase
    .from("conversations")
    .select("organization_id, mode, channel")
    .eq("id", id)
    .maybeSingle();
  if (readError) {
    logger.error({ userId: user.id, conversationId: id, code: readError.code }, "no se pudo leer la conversación");
    return { error: "failed", doneAt: null };
  }
  if (!conversation || conversation.mode !== "human") return { error: "not_allowed", doneAt: null };
  // Por un canal sin envío el mensaje no llegaría nunca (M-01): ni se guarda.
  if (!canReplyOn(conversation.channel)) return { error: "channel_unavailable", doneAt: null };

  // La app solo puede escribir estas tres columnas (grant insert de la
  // migración); con cualquier otra, Postgres rechaza el insert. El tipo generado
  // pide además autor y sentido, que pone guard_staff_message: de ahí el cast.
  const row: StaffMessageInsert = { organization_id: conversation.organization_id, conversation_id: id, content };
  const { error } = await supabase.from("messages").insert(row as MessageInsert);
  if (error) {
    const reason = inboxErrorFor(error.code);
    if (reason === "failed")
      logger.error({ userId: user.id, conversationId: id, code: error.code }, "no se pudo enviar el mensaje del equipo");
    return { error: reason, doneAt: null };
  }

  // Sin el texto: los logs nunca llevan lo que se escribe a un cliente.
  securityEvent("inbox.staff_message_sent", {
    userId: user.id,
    organizationId: conversation.organization_id,
    conversationId: id,
  });
  revalidatePath("/app/inbox", "layout");
  return { error: null, doneAt: Date.now() };
}
