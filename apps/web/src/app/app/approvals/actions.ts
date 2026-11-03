"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { securityEvent } from "@/lib/observability/logger";
import { createClient } from "@/lib/supabase/server";
import { idSchema } from "@/lib/validation";

// Aprobar o rechazar lo que propuso el agente (paso 4d-3d, ADR 0047 §3). La
// barrera es la base de datos: RLS (approvals_decide) exige el rol y el
// alcance que pide, aal2 cuando toca y que siga pendiente y sin caducar;
// guard_approval pone quién decidió y cuándo, y emite approval.decided, que el
// worker ejecuta (agent.approval). Aquí solo se valida la forma.

const decisionSchema = z.object({ id: idSchema, decision: z.enum(["approved", "rejected"]) });

export interface DecideState {
  error: "invalid" | "not_allowed" | null;
}

export async function decideApproval(_prev: DecideState, formData: FormData): Promise<DecideState> {
  const user = await requireUser();
  const parsed = decisionSchema.safeParse({ id: formData.get("id"), decision: formData.get("decision") });
  if (!parsed.success) return { error: "invalid" };
  const { id, decision } = parsed.data;

  const supabase = await createClient();
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
  return { error: null };
}
