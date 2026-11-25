"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getSessionAal, requireUser } from "@/lib/auth/session";
import { getIngressPublicKey } from "@/lib/integrations/key-ingress";
import {
  insertErrorFor,
  submissionResult,
  submitKeyFlow,
  type KeyIntegrationStore,
  type KeySubmissionResult,
} from "@/lib/integrations/key-flow";
import { KEY_INTEGRATIONS } from "@/lib/integrations/key-providers";
import { securityEvent } from "@/lib/observability/logger";
import { getScopeContext } from "@/lib/scope-data";
import { createClient } from "@/lib/supabase/server";

// Conectar, rotar y desconectar una integración con clave del cliente (hoy,
// Koibox; ADR 0055, int-koibox). La lógica está en lib/integrations/key-flow.ts
// (con sus tests); aquí, el permiso, las filas con el cliente de la persona y
// los eventos.
//
// - Del cliente llegan el proveedor (solo si está en la lista) y la clave. La
//   organización es la activa de la sesión; el id del envío lo genera el
//   servidor. La clave no sale de esta función más que cifrada hacia el worker:
//   ni a los logs, ni a los eventos, ni de vuelta.
// - La barrera es la base de datos: RLS (org_admin con aal2), las listas
//   blancas y el freno de 5 envíos en 15 minutos. Aquí se comprueba antes para
//   no cifrar nada sin permiso.
// - Activa, en error y el resultado del envío los pone el worker, cuando
//   comprueba la clave contra el proveedor.

const PATH = "/app/settings/integrations";

export type SubmitKeyResult =
  | { ok: true; submissionId: string }
  | { ok: false; error: "invalid" | "invalid_key" | "not_allowed" | "unavailable" | "too_many" };

export type DisconnectKeyResult = { ok: true } | { ok: false; error: "invalid" | "not_allowed" };

async function adminContext() {
  const user = await requireUser();
  const { organization, role } = await getScopeContext();
  if (!organization || role !== "org_admin" || (await getSessionAal()) !== "aal2") return null;
  return { user, organizationId: organization.id };
}

/** La integración de la organización (sin local) y el proveedor, con el cliente de la persona (RLS). */
async function store(organizationId: string, provider: string): Promise<KeyIntegrationStore> {
  const supabase = await createClient();
  return {
    async find() {
      const { data, error } = await supabase
        .from("integrations")
        .select("id, status")
        .eq("organization_id", organizationId)
        .is("location_id", null)
        .eq("provider", provider)
        .eq("kind", "native")
        .maybeSingle();
      return error || !data ? null : data;
    },
    async insertPending() {
      const { data, error } = await supabase
        .from("integrations")
        .insert({ organization_id: organizationId, provider, kind: "native" })
        .select("id")
        .single();
      return error ? null : data.id;
    },
    async setPending(id) {
      const { data, error } = await supabase.from("integrations").update({ status: "pending" }).eq("id", id).select("id");
      return !error && Boolean(data?.[0]);
    },
    async insertSubmission({ id, integrationId, sealed }) {
      // Sin .select(): la app no puede leer los envíos (solo inserta).
      const { error } = await supabase.from("integration_secret_submissions").insert({
        id,
        organization_id: organizationId,
        integration_id: integrationId,
        provider,
        key_ref: sealed.keyRef,
        encrypted_data_key: sealed.encryptedDataKey,
        ciphertext: sealed.ciphertext,
      });
      return error ? insertErrorFor(error.code) : "ok";
    },
    async markDisconnected(id) {
      const { data, error } = await supabase.from("integrations").update({ status: "disconnected" }).eq("id", id).select("id");
      return !error && Boolean(data?.[0]);
    },
  };
}

export async function submitIntegrationKey(provider: string, submittedKey: string): Promise<SubmitKeyResult> {
  if (!KEY_INTEGRATIONS.includes(provider) || typeof submittedKey !== "string") return { ok: false, error: "invalid" };
  const ctx = await adminContext();
  if (!ctx) return { ok: false, error: "not_allowed" };
  const publicKey = getIngressPublicKey();
  if (!publicKey) return { ok: false, error: "unavailable" };

  const submissionId = randomUUID();
  const outcome = await submitKeyFlow(
    await store(ctx.organizationId, provider),
    publicKey,
    { organizationId: ctx.organizationId, provider, submissionId },
    submittedKey,
  );
  revalidatePath(PATH);
  if (!outcome.ok) {
    if (outcome.error === "too_many") {
      securityEvent("integration.key_throttled", {
        userId: ctx.user.id,
        organizationId: ctx.organizationId,
        integrationId: outcome.integrationId ?? null,
        provider,
      });
    }
    return { ok: false, error: outcome.error };
  }
  securityEvent("integration.key_submitted", {
    userId: ctx.user.id,
    organizationId: ctx.organizationId,
    integrationId: outcome.integrationId,
    submissionId,
    provider,
  });
  return { ok: true, submissionId };
}

/** Qué pasó con un envío: la pantalla lo pregunta mientras el worker lo comprueba. */
export async function keySubmissionStatus(provider: string, submissionId: string): Promise<KeySubmissionResult | null> {
  if (!KEY_INTEGRATIONS.includes(provider) || !/^[0-9a-f-]{36}$/.test(submissionId)) return null;
  const ctx = await adminContext();
  if (!ctx) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("integrations")
    .select("last_submission_id, last_submission_result")
    .eq("organization_id", ctx.organizationId)
    .is("location_id", null)
    .eq("provider", provider)
    .eq("kind", "native")
    .maybeSingle();
  if (error) return null;
  return submissionResult(data, submissionId);
}

export async function disconnectKeyIntegration(provider: string): Promise<DisconnectKeyResult> {
  if (!KEY_INTEGRATIONS.includes(provider)) return { ok: false, error: "invalid" };
  const ctx = await adminContext();
  if (!ctx) return { ok: false, error: "not_allowed" };
  const rows = await store(ctx.organizationId, provider);
  const existing = await rows.find();
  // El secreto lo borra el worker, con el evento integration.disconnected.
  if (!existing || existing.status === "disconnected" || !(await rows.markDisconnected(existing.id))) {
    return { ok: false, error: "not_allowed" };
  }
  revalidatePath(PATH);
  securityEvent("integration.disconnected", {
    userId: ctx.user.id,
    organizationId: ctx.organizationId,
    integrationId: existing.id,
    provider,
  });
  return { ok: true };
}
