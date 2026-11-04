import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isWaiting, type TestChat, type TestChatMessage, type TestChatRun } from "./test-chat";

// El chat de pruebas de un agente (paso 4d-3e, MANUAL §5.1): la conversación de
// prueba abierta de la persona con ese agente en un local, con lo que hizo el
// agente en cada turno. Todo se lee con su sesión (RLS): su contacto de prueba
// (identidad 'test' con su id), la conversación, los mensajes, los runs, las
// ejecuciones y sus aprobaciones, solo de los locales de su alcance.

const HISTORY_LIMIT = 100;

const EMPTY: TestChat = { conversationId: null, messages: [], runs: [], waiting: false };

function check<T>(result: { data: T; error: unknown }, what: string): T {
  if (result.error) throw new Error(`No se pudo cargar ${what}`, { cause: result.error });
  return result.data;
}

/** El agente de la organización con esa clave, o null. */
export async function findAgentId(organizationId: string, agentKey: string): Promise<string | null> {
  const supabase = await createClient();
  const row = check(
    await supabase
      .from("agents")
      .select("id, type:agent_types!inner(key)")
      .eq("organization_id", organizationId)
      .eq("type.key", agentKey)
      .maybeSingle(),
    "el agente",
  );
  return row?.id ?? null;
}

export async function loadTestChat(input: { organizationId: string; agentId: string; locationId: string; userId: string; now?: Date }): Promise<TestChat> {
  const supabase = await createClient();
  const identity = check(
    await supabase
      .from("contact_identities")
      .select("contact_id")
      .eq("organization_id", input.organizationId)
      .eq("kind", "test")
      .eq("external_id", input.userId)
      .maybeSingle(),
    "tu contacto de prueba",
  );
  if (!identity) return EMPTY;

  const conversation = check(
    await supabase
      .from("conversations")
      .select("id")
      .eq("organization_id", input.organizationId)
      .eq("contact_id", identity.contact_id)
      .eq("agent_id", input.agentId)
      .eq("location_id", input.locationId)
      .neq("mode", "closed")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    "la conversación de prueba",
  );
  if (!conversation) return EMPTY;

  const messages = (
    check(
      await supabase
        .from("messages")
        .select("id, author, content, created_at")
        .eq("conversation_id", conversation.id)
        .order("created_at", { ascending: false })
        .limit(HISTORY_LIMIT),
      "los mensajes",
    ) ?? []
  )
    .reverse()
    .map((row) => ({ id: row.id, author: row.author as TestChatMessage["author"], content: row.content, createdAt: row.created_at }));

  const contactMessages = messages.filter((message) => message.author === "contact");
  const runRows =
    contactMessages.length === 0
      ? []
      : (check(
          await supabase
            .from("agent_runs")
            .select("id, trigger_ref, status, created_at")
            .eq("organization_id", input.organizationId)
            .in(
              "trigger_ref",
              contactMessages.map((message) => message.id),
            ),
          "lo que hizo el agente",
        ) ?? []);
  const stepRows =
    runRows.length === 0
      ? []
      : (check(
          await supabase
            .from("executions")
            .select("id, run_id, skill_key, status, preview, created_at, approval:approvals(id, status)")
            .in(
              "run_id",
              runRows.map((run) => run.id),
            )
            .order("created_at", { ascending: true }),
          "los pasos del agente",
        ) ?? []);

  const runs: TestChatRun[] = runRows.map((run) => ({
    id: run.id,
    messageId: run.trigger_ref ?? "",
    status: run.status,
    steps: stepRows
      .filter((step) => step.run_id === run.id)
      .map((step) => ({
        id: step.id,
        skillKey: step.skill_key,
        status: step.status,
        summary: summaryOf(step.preview),
        approval: step.approval ? { id: step.approval.id, status: step.approval.status } : null,
      })),
  }));

  return { conversationId: conversation.id, messages, runs, waiting: isWaiting(messages, runs, input.now ?? new Date()) };
}

function summaryOf(preview: unknown): string | null {
  if (preview && typeof preview === "object" && "summary" in preview && typeof preview.summary === "string") return preview.summary;
  return null;
}
