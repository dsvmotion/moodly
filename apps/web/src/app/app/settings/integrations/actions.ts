"use server";

import { platformIntegration, type PlatformIntegration } from "@repo/integrations/platform";
import { revalidatePath } from "next/cache";
import { getSessionAal, requireUser } from "@/lib/auth/session";
import { connectFlow, disconnectFlow, type IntegrationStore } from "@/lib/integrations/flows";
import { getConnectorPlatform } from "@/lib/integrations/platform";
import { logger, securityEvent } from "@/lib/observability/logger";
import { getScopeContext } from "@/lib/scope-data";
import { createClient } from "@/lib/supabase/server";

// Conectar y desconectar una integración de plataforma (O-02, ADR 0053). La
// lógica está en lib/integrations/flows.ts (con sus tests, también la carrera
// con el webhook); aquí, el permiso, la fila con el cliente de la persona y los
// eventos.
//
// - Del cliente solo llega la clave del proveedor, y vale solo si está en el
//   catálogo. La organización es la activa de la sesión; quien conecta, la
//   persona de la sesión; la fila, la que crea o reutiliza RLS. Esas tres cosas
//   van como etiquetas a la sesión de Nango y vuelven firmadas en el webhook.
// - La barrera es la base de datos: RLS deja escribir solo al org_admin con
//   aal2 y guard_integration_write solo deja «pendiente» o «desconectada». Aquí
//   se comprueba antes para no pedirle nada a Nango sin permiso.
// - Activa solo la pone el worker, al llegar el webhook firmado de Nango.

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

/** La fila de la organización y el proveedor, con el cliente de la persona (RLS). */
async function store(organizationId: string, entry: PlatformIntegration): Promise<IntegrationStore> {
  const supabase = await createClient();
  return {
    async find() {
      const { data, error } = await supabase
        .from("integrations")
        .select("id, status, external_connection_id")
        .eq("organization_id", organizationId)
        .is("location_id", null)
        .eq("provider", entry.provider)
        .eq("kind", "platform")
        .maybeSingle();
      if (error || !data) return null;
      return { id: data.id, status: data.status, externalConnectionId: data.external_connection_id };
    },
    async insertPending() {
      const { data, error } = await supabase
        .from("integrations")
        .insert({ organization_id: organizationId, provider: entry.provider, kind: "platform" })
        .select("id")
        .single();
      return error ? null : data.id;
    },
    async setPending(id) {
      // Queda a nombre de quien reconecta (lo pone la guarda).
      const { data, error } = await supabase.from("integrations").update({ status: "pending" }).eq("id", id).select("id");
      return !error && Boolean(data?.[0]);
    },
    async markDisconnected(id, expectedConnectionId) {
      // Solo si sigue apuntando a la conexión que se borró en Nango.
      const base = supabase.from("integrations").update({ status: "disconnected", external_connection_id: null }).eq("id", id);
      const { data, error } = await (expectedConnectionId === null
        ? base.is("external_connection_id", null)
        : base.eq("external_connection_id", expectedConnectionId)
      ).select("id");
      return !error && Boolean(data?.[0]);
    },
  };
}

export async function startConnect(provider: string): Promise<ConnectResult> {
  const entry = platformIntegration(provider);
  if (!entry) return { ok: false, error: "invalid" };
  const ctx = await adminContext();
  if (!ctx) return { ok: false, error: "not_allowed" };
  const platform = getConnectorPlatform();
  if (!platform) return { ok: false, error: "unavailable" };

  const outcome = await connectFlow(await store(ctx.organizationId, entry), platform, entry, {
    organizationId: ctx.organizationId,
    userId: ctx.user.id,
  });
  revalidatePath(PATH);
  if (!outcome.ok || !outcome.connectLink) {
    if (outcome.error === "platform_failed") {
      logger.error(
        { organization_id: ctx.organizationId, integration_id: outcome.integrationId ?? null, kind: outcome.platformErrorKind ?? null },
        "Nango no creó la sesión de conexión",
      );
    }
    return { ok: false, error: outcome.error ?? "not_allowed" };
  }
  securityEvent("integration.connect_started", {
    userId: ctx.user.id,
    organizationId: ctx.organizationId,
    integrationId: outcome.integrationId,
    provider: entry.provider,
  });
  return { ok: true, connectLink: outcome.connectLink };
}

export async function disconnect(provider: string): Promise<DisconnectResult> {
  const entry = platformIntegration(provider);
  if (!entry) return { ok: false, error: "invalid" };
  const ctx = await adminContext();
  if (!ctx) return { ok: false, error: "not_allowed" };
  const platform = getConnectorPlatform();
  if (!platform) return { ok: false, error: "unavailable" };

  const outcome = await disconnectFlow(await store(ctx.organizationId, entry), platform, entry);
  revalidatePath(PATH);
  if (!outcome.ok) {
    if (outcome.error === "platform_failed") {
      // La fila sigue como estaba: la conexión sigue viva en Nango.
      securityEvent("integration.disconnect_failed", {
        userId: ctx.user.id,
        organizationId: ctx.organizationId,
        integrationId: outcome.integrationId,
        provider: entry.provider,
        reason: outcome.platformErrorKind ?? "unknown",
      });
    } else if (outcome.deleted.length > 0) {
      logger.error(
        { organization_id: ctx.organizationId, integration_id: outcome.integrationId ?? null, deleted: outcome.deleted.length },
        "se borraron conexiones en Nango pero la fila no pasó a desconectada",
      );
    }
    return { ok: false, error: outcome.error ?? "not_allowed" };
  }
  securityEvent("integration.disconnected", {
    userId: ctx.user.id,
    organizationId: ctx.organizationId,
    integrationId: outcome.integrationId,
    provider: entry.provider,
    deleted: outcome.deleted.length,
  });
  return { ok: true };
}
