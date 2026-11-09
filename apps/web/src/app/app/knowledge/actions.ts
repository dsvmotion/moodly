"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { securityEvent } from "@/lib/observability/logger";
import { getScopeContext } from "@/lib/scope-data";
import { createClient } from "@/lib/supabase/server";
import { createSourceSchema, deleteSourceSchema, updateSourceSchema, type KnowledgeFormState } from "./schema";

// Crear, cambiar y borrar fuentes de conocimiento (paso B20-3, ADR 0048 §2). La
// barrera es la base de datos: RLS deja escribir solo al org_admin con aal2;
// guard_knowledge_source pone el autor y el estado (al crear, o al cambiar el
// texto, vuelve a pending y emite knowledge_source.pending, que el worker
// indexa); validate_knowledge_source comprueba que el local es de la
// organización. Aquí solo se valida la forma. Los logs llevan ids, nunca el
// texto de la fuente.

const PATH = "/app/knowledge";

export async function createKnowledgeSource(_prev: KnowledgeFormState, formData: FormData): Promise<KnowledgeFormState> {
  const user = await requireUser();
  const parsed = createSourceSchema.safeParse({
    type: formData.get("type"),
    locationId: formData.get("locationId"),
    title: formData.get("title"),
    body: formData.get("body"),
  });
  if (!parsed.success) return { error: "invalid", savedAt: null };
  const { type, locationId, title, body } = parsed.data;
  // La organización es la activa de la sesión, no la que diga el formulario.
  const { organization } = await getScopeContext();
  if (!organization) return { error: "not_allowed", savedAt: null };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("knowledge_sources")
    .insert({ organization_id: organization.id, location_id: locationId || null, type, title, body })
    .select("id")
    .single();
  if (error) return { error: error.code === "23514" ? "invalid" : "not_allowed", savedAt: null };

  securityEvent("knowledge.source_created", {
    userId: user.id,
    organizationId: organization.id,
    sourceId: data.id,
    sourceType: type,
    locationId: locationId || null,
  });
  revalidatePath(PATH);
  return { error: null, savedAt: Date.now() };
}

export async function updateKnowledgeSource(_prev: KnowledgeFormState, formData: FormData): Promise<KnowledgeFormState> {
  const user = await requireUser();
  const parsed = updateSourceSchema.safeParse({ id: formData.get("id"), title: formData.get("title"), body: formData.get("body") });
  if (!parsed.success) return { error: "invalid", savedAt: null };
  const { id, title, body } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("knowledge_sources")
    .update({ title, body })
    .eq("id", id)
    .select("organization_id, status");
  // Sin fila: no se puede cambiar (sin rol o sin aal2, de otra organización o ya borrada).
  const updated = data?.[0];
  if (error) return { error: error.code === "23514" ? "invalid" : "not_allowed", savedAt: null };
  if (!updated) return { error: "not_allowed", savedAt: null };

  securityEvent("knowledge.source_updated", {
    userId: user.id,
    organizationId: updated.organization_id,
    sourceId: id,
    reindex: updated.status === "pending",
  });
  revalidatePath(PATH);
  return { error: null, savedAt: Date.now() };
}

export async function deleteKnowledgeSource(_prev: KnowledgeFormState, formData: FormData): Promise<KnowledgeFormState> {
  const user = await requireUser();
  const parsed = deleteSourceSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { error: "invalid", savedAt: null };
  const { id } = parsed.data;

  // Sus fragmentos se borran con ella (clave foránea en cascada).
  const supabase = await createClient();
  const { data, error } = await supabase.from("knowledge_sources").delete().eq("id", id).select("organization_id");
  const deleted = data?.[0];
  if (error || !deleted) return { error: "not_allowed", savedAt: null };

  securityEvent("knowledge.source_deleted", { userId: user.id, organizationId: deleted.organization_id, sourceId: id });
  revalidatePath(PATH);
  return { error: null, savedAt: Date.now() };
}
