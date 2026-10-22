"use server";

import { getTranslations } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

// Invitaciones con consentimiento (migración invitations). La barrera real es la
// base de datos: create_invitation pasa por RLS (solo org_admin de esa
// organización) y accept_invitation comprueba token, caducidad y email. Aquí solo
// se validan formas y se traducen los errores.

const ROLES = ["org_admin", "region_manager", "location_manager", "staff"] as const;
type Role = (typeof ROLES)[number];
const isRole = (value: unknown): value is Role => typeof value === "string" && (ROLES as readonly string[]).includes(value);
const text = (value: FormDataEntryValue | null) => (typeof value === "string" ? value.trim() : "");

export interface InviteState {
  error: string | null;
  /** Ruta del enlace de invitación. Solo se devuelve una vez: no se puede recuperar. */
  link: string | null;
}

export async function createInvitation(_prev: InviteState, formData: FormData): Promise<InviteState> {
  await requireUser();
  const t = await getTranslations("invitations");
  const organizationId = text(formData.get("organizationId"));
  const email = text(formData.get("email"));
  const role = formData.get("role");
  const scopeId = text(formData.get("scopeId"));
  if (!organizationId || !email || !isRole(role)) return { error: t("errors.invalid"), link: null };

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

  revalidatePath("/app/settings/organization");
  return { error: null, link: `/app/invitation?token=${encodeURIComponent(data)}` };
}

export async function revokeInvitation(formData: FormData): Promise<void> {
  await requireUser();
  const id = text(formData.get("id"));
  if (!id) return;
  const supabase = await createClient();
  // RLS: solo un org_admin de su organización; la guarda solo deja revocar.
  await supabase.from("invitations").update({ revoked_at: new Date().toISOString() }).eq("id", id);
  revalidatePath("/app/settings/organization");
}

export interface AcceptState {
  error: string | null;
}

export async function acceptInvitation(_prev: AcceptState, formData: FormData): Promise<AcceptState> {
  await requireUser();
  const t = await getTranslations("invitations.accept");
  const token = text(formData.get("token"));
  if (!token) return { error: t("invalid") };

  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_invitation", { p_token: token });
  if (error) return { error: t(error.code === "23505" ? "already" : "invalid") };
  // La barra lateral (organización y alcance) vive en el layout: hay que rehacerlo.
  revalidatePath("/app", "layout");
  redirect("/app");
}
