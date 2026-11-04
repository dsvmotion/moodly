"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { logger } from "@/lib/observability/logger";
import { createClient } from "@/lib/supabase/server";
import { testChatErrorFor, type TestChatError } from "@/lib/test-chat";
import { idSchema } from "@/lib/validation";

// El chat de pruebas (paso 4d-3e). La barrera es la base de datos:
// send_test_message escribe como el contacto de prueba de la persona, solo en
// su alcance (un org_admin con aal2), nunca con un agente en pausa y como mucho
// 30 mensajes por hora; close_test_conversation cierra solo la suya. Aquí solo
// se valida la forma y se traduce el error.

const MAX_LENGTH = 2000;

const sendSchema = z.object({
  agentId: idSchema,
  locationId: idSchema,
  content: z.string().trim().min(1).max(MAX_LENGTH),
});
const restartSchema = z.object({ conversationId: idSchema });

export interface TestChatState {
  error: TestChatError | null;
  /** Cambia en cada envío correcto: el formulario se vacía. */
  sentAt: number | null;
}

export async function sendTestMessage(_prev: TestChatState, formData: FormData): Promise<TestChatState> {
  const user = await requireUser();
  const parsed = sendSchema.safeParse({
    agentId: formData.get("agentId"),
    locationId: formData.get("locationId"),
    content: formData.get("content"),
  });
  if (!parsed.success) return { error: "invalid", sentAt: null };
  const { agentId, locationId, content } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.rpc("send_test_message", { p_agent_id: agentId, p_location_id: locationId, p_content: content });
  if (error) {
    const reason = testChatErrorFor(error.code);
    if (reason === "failed") logger.error({ userId: user.id, agentId, code: error.code }, "no se pudo enviar el mensaje de prueba");
    return { error: reason, sentAt: null };
  }
  logger.info({ userId: user.id, agentId, locationId }, "mensaje de prueba enviado");
  revalidatePath("/app/agents/[type]", "page");
  return { error: null, sentAt: Date.now() };
}

export async function restartTestChat(_prev: TestChatState, formData: FormData): Promise<TestChatState> {
  const user = await requireUser();
  const parsed = restartSchema.safeParse({ conversationId: formData.get("conversationId") });
  if (!parsed.success) return { error: "invalid", sentAt: null };

  const supabase = await createClient();
  const { error } = await supabase.rpc("close_test_conversation", { p_conversation_id: parsed.data.conversationId });
  if (error) return { error: testChatErrorFor(error.code), sentAt: null };
  logger.info({ userId: user.id, conversationId: parsed.data.conversationId }, "chat de pruebas reiniciado");
  revalidatePath("/app/agents/[type]", "page");
  return { error: null, sentAt: null };
}
