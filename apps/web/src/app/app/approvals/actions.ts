"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { parseApprovalInput, slotHasPassed } from "@/lib/approval-input";
import { securityEvent } from "@/lib/observability/logger";
import { createClient } from "@/lib/supabase/server";
import { idSchema } from "@/lib/validation";

// Aprobar o rechazar lo que propuso el agente (paso 4d-3d, ADR 0047 §3). La
// barrera es la base de datos: RLS (approvals_decide) exige el rol y el
// alcance que pide, aal2 cuando toca y que siga pendiente y sin caducar;
// guard_approval pone quién decidió y cuándo, y emite approval.decided, que el
// worker ejecuta (agent.approval). Aquí se valida la forma y, al aprobar, que
// una reserva o un cambio de cita no sea para una hora que ya pasó (revisión de
// V10, OA02): al ejecutarla fallaría igual (la skill y la base de datos
// rechazan el pasado), pero la persona creería que la aprobó.

const decisionSchema = z.object({ id: idSchema, decision: z.enum(["approved", "rejected"]) });

export interface DecideState {
  error: "invalid" | "not_allowed" | "slot_passed" | null;
}

export async function decideApproval(_prev: DecideState, formData: FormData): Promise<DecideState> {
  const user = await requireUser();
  const parsed = decisionSchema.safeParse({ id: formData.get("id"), decision: formData.get("decision") });
  if (!parsed.success) return { error: "invalid" };
  const { id, decision } = parsed.data;

  const supabase = await createClient();
  if (decision === "approved") {
    const { data: pending } = await supabase.from("approvals").select("execution:executions(skill_key, input)").eq("id", id).maybeSingle();
    const execution = pending?.execution;
    if (execution && slotHasPassed(parseApprovalInput(execution.skill_key, execution.input), new Date())) {
      securityEvent("agent.approval_refused", { userId: user.id, approvalId: id, reason: "slot_passed" });
      return { error: "slot_passed" };
    }
  }
  const { data, error } = await supabase
    .from("approvals")
    .update({ status: decision })
    .eq("id", id)
    .eq("status", "pending")
    .select("organization_id, effect_class");
  // Sin fila: no se puede decidir (sin rol o alcance, ya decidida o caducada).
  const decided = data?.[0];
  if (error || !decided) return { error: "not_allowed" };

  securityEvent(decision === "approved" ? "agent.approval_approved" : "agent.approval_rejected", {
    userId: user.id,
    organizationId: decided.organization_id,
    approvalId: id,
    effectClass: decided.effect_class,
  });
  revalidatePath("/app/approvals");
  // También el chat de pruebas del agente, que muestra sus aprobaciones (paso 4d-3e).
  revalidatePath("/app/agents/[type]", "page");
  return { error: null };
}
