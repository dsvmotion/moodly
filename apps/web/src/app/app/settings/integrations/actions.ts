"use server";

import { platformIntegration, ConnectorPlatformError } from "@repo/integrations/platform";
import { revalidatePath } from "next/cache";
import { getSessionAal, requireUser } from "@/lib/auth/session";
import { getConnectorPlatform } from "@/lib/integrations/platform";
import { logger, securityEvent } from "@/lib/observability/logger";
import { getScopeContext } from "@/lib/scope-data";
import { createClient } from "@/lib/supabase/server";

// Conectar y desconectar una integración de plataforma (O-02, ADR 0053).
//
// - Del cliente solo llega la clave del proveedor, y vale solo si está en el
//   catálogo. La organización es la activa de la sesión; quien conecta, la
//   persona de la sesión; la fila, la que crea o reutiliza RLS. Esas tres cosas
//   van como etiquetas a la sesión de Nango y vuelven firmadas en el webhook.
// - La barrera es la base de datos: RLS deja escribir solo al org_admin con
//   aal2 y guard_integration_write solo deja «pendiente» o «desconectada». Aquí
//   se comprueba antes para no pedirle nada a Nango sin permiso.
// - Activa solo la pone el worker, al llegar el webhook firmado de Nango.
// - Desconectar borra primero la conexión en Nango; si Nango falla, la fila no
//   cambia, se registra y la pantalla lo dice.

const PATH = "/app/settings/integrations";

export type ConnectResult =
  | { ok: true; connectLink: string }
  | { ok: false; error: "invalid" | "not_allowed" | "unavailable" | "platform_failed" };

export type DisconnectResult = { ok: true } | { ok: false; error: "invalid" | "not_allowed" | "unavailable" | "platform_failed" };

async function adminContext() {
  const user = await requireUser();
  const { organization, role } = await getScopeContext();
  if (!organization || role !== "org_admin" || (await getSessionAal()) !== "aal2") return null;
  return { user, organizationId: organization.id };
}

export async function startConnect(provider: string): Promise<ConnectResult> {
  const entry = platformIntegration(provider);
  if (!entry) return { ok: false, error: "invalid" };
  const ctx = await adminContext();
  if (!ctx) return { ok: false, error: "not_allowed" };
  const platform = getConnectorPlatform();
  if (!platform) return { ok: false, error: "unavailable" };

  const supabase = await createClient();
  const { data: existing, error: readError } = await supabase
    .from("integrations")
    .select("id")
    .eq("organization_id", ctx.organizationId)
    .is("location_id", null)
    .eq("provider", entry.provider)
    .eq("kind", "platform")
    .maybeSingle();
  if (readError) return { ok: false, error: "not_allowed" };

  let integrationId: string;
  if (existing) {
    // Reconectar: vuelve a pendiente, a nombre de quien reconecta (lo pone la guarda).
    const { data, error } = await supabase.from("integrations").update({ status: "pending" }).eq("id", existing.id).select("id");
    if (error || !data?.[0]) return { ok: false, error: "not_allowed" };
    integrationId = existing.id;
  } else {
    const { data, error } = await supabase
      .from("integrations")
      .insert({ organization_id: ctx.organizationId, provider: entry.provider, kind: "platform" })
      .select("id")
      .single();
    if (error) return { ok: false, error: "not_allowed" };
    integrationId = data.id;
  }

  try {
    const session = await platform.createConnectSession({
      integrationKey: entry.integrationKey,
      tags: { organization_id: ctx.organizationId, end_user_id: ctx.user.id, integration_id: integrationId },
    });
    securityEvent("integration.connect_started", {
      userId: ctx.user.id,
      organizationId: ctx.organizationId,
      integrationId,
      provider: entry.provider,
    });
    revalidatePath(PATH);
    return { ok: true, connectLink: session.connectLink };
  } catch (err) {
    logger.error(
      { err, organization_id: ctx.organizationId, integration_id: integrationId, kind: err instanceof ConnectorPlatformError ? err.kind : "unknown" },
      "Nango no creó la sesión de conexión",
    );
    revalidatePath(PATH);
    return { ok: false, error: "platform_failed" };
  }
}

export async function disconnect(provider: string): Promise<DisconnectResult> {
  const entry = platformIntegration(provider);
  if (!entry) return { ok: false, error: "invalid" };
  const ctx = await adminContext();
  if (!ctx) return { ok: false, error: "not_allowed" };

  const supabase = await createClient();
  const { data: row, error: readError } = await supabase
    .from("integrations")
    .select("id, external_connection_id")
    .eq("organization_id", ctx.organizationId)
    .is("location_id", null)
    .eq("provider", entry.provider)
    .eq("kind", "platform")
    .maybeSingle();
  if (readError || !row) return { ok: false, error: "not_allowed" };

  if (row.external_connection_id) {
    const platform = getConnectorPlatform();
    if (!platform) return { ok: false, error: "unavailable" };
    try {
      await platform.deleteConnection(entry.integrationKey, row.external_connection_id);
    } catch (err) {
      // La fila sigue como estaba: la conexión sigue viva en Nango.
      securityEvent("integration.disconnect_failed", {
        userId: ctx.user.id,
        organizationId: ctx.organizationId,
        integrationId: row.id,
        provider: entry.provider,
        reason: err instanceof ConnectorPlatformError ? err.kind : "unknown",
      });
      return { ok: false, error: "platform_failed" };
    }
  }

  const { data, error } = await supabase
    .from("integrations")
    .update({ status: "disconnected", external_connection_id: null })
    .eq("id", row.id)
    .select("id");
  if (error || !data?.[0]) {
    logger.error(
      { organization_id: ctx.organizationId, integration_id: row.id, code: error?.code ?? null },
      "la conexión se borró en Nango pero la fila no pasó a desconectada",
    );
    return { ok: false, error: "not_allowed" };
  }
  securityEvent("integration.disconnected", {
    userId: ctx.user.id,
    organizationId: ctx.organizationId,
    integrationId: row.id,
    provider: entry.provider,
  });
  revalidatePath(PATH);
  return { ok: true };
}
