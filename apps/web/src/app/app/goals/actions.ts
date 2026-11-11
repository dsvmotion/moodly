"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { securityEvent } from "@/lib/observability/logger";
import { getScopeContext } from "@/lib/scope-data";
import { goalMetric } from "@/lib/goals";
import { createClient } from "@/lib/supabase/server";
import { createGoalSchema, deleteGoalSchema, updateGoalSchema, type GoalFormState } from "./schema";

// Crear, cambiar y borrar objetivos (OA19, MANUAL §6.3). La barrera es la base
// de datos: RLS (goals_insert, goals_update y goals_delete) deja escribir al
// org_admin con aal2 en cualquier alcance, al region_manager en sus regiones y
// sus locales y al location_manager en sus locales; validate_goal comprueba
// que la región o el local son de la organización; guard_immutable no deja
// cambiar la organización ni el alcance. Aquí solo se valida la forma. La
// organización es siempre la activa de la sesión, nunca la del formulario.

const PATH = "/app/goals";

/** 23514: un CHECK o validate_goal (datos que no valen); lo demás, RLS o permisos. */
const failure = (code: string | undefined): GoalFormState => ({
  error: code === "23514" ? "invalid" : "not_allowed",
  savedAt: null,
});

export async function createGoal(_prev: GoalFormState, formData: FormData): Promise<GoalFormState> {
  const user = await requireUser();
  const parsed = createGoalSchema.safeParse({
    target: formData.get("target"),
    title: formData.get("title"),
    metricKey: formData.get("metricKey"),
    direction: formData.get("direction"),
    targetValue: formData.get("targetValue"),
    period: formData.get("period"),
    dueDate: formData.get("dueDate") ?? "",
  });
  if (!parsed.success) return { error: "invalid", savedAt: null };
  const { target, title, metricKey, direction, targetValue, period, dueDate } = parsed.data;
  const { organization } = await getScopeContext();
  if (!organization) return { error: "not_allowed", savedAt: null };
  // Un objetivo de toda la organización es de la activa, no de otra.
  if (target.scope === "organization" && target.scopeId !== organization.id) return { error: "not_allowed", savedAt: null };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("goals")
    .insert({
      organization_id: organization.id,
      scope: target.scope,
      scope_id: target.scopeId,
      title,
      metric_key: metricKey,
      direction,
      target_value: targetValue,
      period,
      due_date: dueDate,
    })
    .select("id")
    .single();
  if (error) return failure(error.code);

  securityEvent("goal.created", {
    userId: user.id,
    organizationId: organization.id,
    goalId: data.id,
    scope: target.scope,
    scopeId: target.scopeId,
    metricKey,
  });
  revalidatePath(PATH);
  return { error: null, savedAt: Date.now() };
}

export async function updateGoal(_prev: GoalFormState, formData: FormData): Promise<GoalFormState> {
  const user = await requireUser();
  const parsed = updateGoalSchema.safeParse({
    id: formData.get("id"),
    title: formData.get("title"),
    metricKey: formData.get("metricKey"),
    direction: formData.get("direction"),
    targetValue: formData.get("targetValue"),
    period: formData.get("period"),
    dueDate: formData.get("dueDate") ?? "",
    status: formData.get("status"),
  });
  if (!parsed.success) return { error: "invalid", savedAt: null };
  const { id, title, metricKey, direction, targetValue, period, dueDate, status } = parsed.data;

  const supabase = await createClient();
  // Una métrica fuera del catálogo solo vale si es la que el objetivo ya tenía
  // (no se cambia; se conserva). Se lee con la sesión: sin fila, no se puede.
  if (!goalMetric(metricKey).known) {
    const { data: current } = await supabase.from("goals").select("metric_key").eq("id", id).maybeSingle();
    if (!current) return { error: "not_allowed", savedAt: null };
    if (current.metric_key !== metricKey) return { error: "invalid", savedAt: null };
  }
  const { data, error } = await supabase
    .from("goals")
    .update({ title, metric_key: metricKey, direction, target_value: targetValue, period, due_date: dueDate, status })
    .eq("id", id)
    .select("organization_id");
  if (error) return failure(error.code);
  // Sin fila: no se puede cambiar (sin rol o sin aal2, de otro alcance u organización, o ya borrado).
  const updated = data[0];
  if (!updated) return { error: "not_allowed", savedAt: null };

  securityEvent("goal.updated", { userId: user.id, organizationId: updated.organization_id, goalId: id, status });
  revalidatePath(PATH);
  return { error: null, savedAt: Date.now() };
}

export async function deleteGoal(_prev: GoalFormState, formData: FormData): Promise<GoalFormState> {
  const user = await requireUser();
  const parsed = deleteGoalSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { error: "invalid", savedAt: null };
  const { id } = parsed.data;

  // Sus mediciones (goal_progress) se borran con él (clave foránea en cascada).
  const supabase = await createClient();
  const { data, error } = await supabase.from("goals").delete().eq("id", id).select("organization_id");
  const deleted = data?.[0];
  if (error || !deleted) return { error: "not_allowed", savedAt: null };

  securityEvent("goal.deleted", { userId: user.id, organizationId: deleted.organization_id, goalId: id });
  revalidatePath(PATH);
  return { error: null, savedAt: Date.now() };
}
