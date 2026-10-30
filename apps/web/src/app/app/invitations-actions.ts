"use server";

import { getTranslations } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { securityEvent } from "@/lib/observability/logger";
import { idSchema, inviteSchema, tokenSchema } from "@/lib/validation";
import { createClient } from "@/lib/supabase/server";

// Invitaciones con consentimiento (migración invitations). La barrera real es la
// base de datos: create_invitation pasa por RLS (solo org_admin de esa
// organización) y accept_invitation comprueba token, caducidad y email. Aquí solo
// se validan formas (Zod) y se traducen los errores.

const field = (formData: FormData, name: string) => {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : undefined;
};

export interface InviteState {
  error: string | null;
  /** Ruta del enlace de invitación. Solo se devuelve una vez: no se puede recuperar. */
  link: string | null;
}

export async function createInvitation(_prev: InviteState, formData: FormData): Promise<InviteState> {
  const user = await requireUser();
  const t = await getTranslations("invitations");
  const parsed = inviteSchema.safeParse({
    organizationId: field(formData, "organizationId"),
    email: field(formData, "email"),
    role: field(formData, "role"),
    scopeId: field(formData, "scopeId"),
  });
  if (!parsed.success) return { error: t("errors.invalid"), link: null };
  const { organizationId, email, role, scopeId } = parsed.data;

  // El alcance depende del rol (la base de datos exige la misma coherencia).
  const regions = role === "region_manager" && scopeId ? [scopeId] : [];
  const locations = (role === "location_manager" || role === "staff") && scopeId ? [scopeId] : [];

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_invitation", {
    p_organization_id: organizationId,
    p_email: email,
    p_role: role,
    p_scope_region_ids: regions,
    p_scope_location_ids: locations,
  });
  if (error || !data) return { error: t(error?.code === "42501" ? "errors.forbidden" : "errors.invalid"), link: null };

  securityEvent("org.invitation_created", { userId: user.id, organizationId, role });
  revalidatePath("/app/settings/general");
  return { error: null, link: `/app/invitation?token=${encodeURIComponent(data)}` };
}

export async function revokeInvitation(formData: FormData): Promise<void> {
  const user = await requireUser();
  const parsed = idSchema.safeParse(field(formData, "id"));
  if (!parsed.success) return;
  const id = parsed.data;
  const supabase = await createClient();
  // RLS: solo un org_admin de su organización; la guarda solo deja revocar.
  const { data } = await supabase
    .from("invitations")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .select("organization_id");
  if (data?.[0]) securityEvent("org.invitation_revoked", { userId: user.id, organizationId: data[0].organization_id, invitation_id: id });
  revalidatePath("/app/settings/general");
}

export interface AcceptState {
  error: string | null;
}

export async function acceptInvitation(_prev: AcceptState, formData: FormData): Promise<AcceptState> {
  const user = await requireUser();
  const t = await getTranslations("invitations.accept");
  const parsed = tokenSchema.safeParse(field(formData, "token"));
  if (!parsed.success) return { error: t("invalid") };
  const token = parsed.data;

  const supabase = await createClient();
  const { data: organizationId, error } = await supabase.rpc("accept_invitation", { p_token: token });
  if (error) return { error: t(error.code === "23505" ? "already" : "invalid") };
  securityEvent("org.invitation_accepted", { userId: user.id, organizationId });
  // La barra lateral (organización y alcance) vive en el layout: hay que rehacerlo.
  revalidatePath("/app", "layout");
  redirect("/app");
}
