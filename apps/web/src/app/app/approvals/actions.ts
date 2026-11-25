"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { parseApprovalInput, replyEditFor, slotHasPassed } from "@/lib/approval-input";
import { securityEvent } from "@/lib/observability/logger";
import { createClient } from "@/lib/supabase/server";
import { idSchema } from "@/lib/validation";

// Aprobar o rechazar lo que propuso el agente (paso 4d-3d, ADR 0047 §3). La
// barrera es la base de datos: RLS (approvals_decide) exige el rol y el
// alcance que pide, aal2 cuando toca y que siga pendiente y sin caducar;
// guard_approval pone quién decidió y cuándo, solo deja corregir el texto de
// una respuesta al aprobarla y no deja aprobar una reserva cuya hora pasó
// (20261124120000); y emite approval.decided, que el worker ejecuta
// (agent.approval). Aquí se valida la forma, con las mismas reglas, para que
// la persona vea por qué antes de decidir. Los eventos llevan ids y si hubo
// corrección, nunca el texto.

const decisionSchema = z.object({
  id: idSchema,
  decision: z.enum(["approved", "rejected"]),
  // El texto de la respuesta tal como lo deja quien aprueba (OA02). Solo cuenta al aprobar una respuesta.
  text: z.string().optional(),
});

export interface DecideState {
  error: "invalid" | "not_allowed" | "slot_passed" | "edit_invalid" | null;
}

export async function decideApproval(_prev: DecideState, formData: FormData): Promise<DecideState> {
  const user = await requireUser();
  const text = formData.get("text");
  const parsed = decisionSchema.safeParse({
    id: formData.get("id"),
    decision: formData.get("decision"),
    ...(typeof text === "string" ? { text } : {}),
  });
  if (!parsed.success) return { error: "invalid" };
  const { id, decision } = parsed.data;

  const supabase = await createClient();
  let edited: { text: string } | null = null;
  if (decision === "approved") {
    const { data: pending, error: readError } = await supabase
      .from("approvals")
      .select("execution:executions(skill_key, input)")
      .eq("id", id)
      .maybeSingle();
    // Sin poder leerla no se comprueba la hora ni la corrección: no se aprueba (falla cerrada).
    if (readError || !pending) return { error: "invalid" };
    const execution = pending.execution;
    const input = execution ? parseApprovalInput(execution.skill_key, execution.input) : { kind: "other" as const };
    if (slotHasPassed(input, new Date())) {
      securityEvent("agent.approval_refused", { userId: user.id, approvalId: id, reason: "slot_passed" });
      return { error: "slot_passed" };
    }
    if (parsed.data.text !== undefined) {
      const edit = replyEditFor(input, parsed.data.text);
      if (!edit.ok) return { error: edit.reason === "invalid" ? "edit_invalid" : "invalid" };
      edited = edit.edited;
    }
  }
  const { data, error } = await supabase
    .from("approvals")
    .update(edited ? { status: decision, edited_input: edited } : { status: decision })
    .eq("id", id)
    .eq("status", "pending")
    .select("organization_id, effect_class");
  if (error?.code === "BK001") return { error: "slot_passed" };
  if (error?.code === "23514") return { error: "edit_invalid" };
  // Sin fila: no se puede decidir (sin rol o alcance, ya decidida o caducada).
  const decided = data?.[0];
  if (error || !decided) return { error: "not_allowed" };

  securityEvent(decision === "approved" ? "agent.approval_approved" : "agent.approval_rejected", {
    userId: user.id,
    organizationId: decided.organization_id,
    approvalId: id,
    effectClass: decided.effect_class,
    ...(decision === "approved" ? { edited: edited !== null, ...(edited ? { fields: "text" } : {}) } : {}),
  });
  revalidatePath("/app/approvals");
  // También el chat de pruebas del agente, que muestra sus aprobaciones (paso 4d-3e).
  revalidatePath("/app/agents/[type]", "page");
  return { error: null };
}
