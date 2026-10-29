import "server-only";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { cache } from "react";
import { getCurrentUser } from "@/lib/auth/session";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { createClient } from "@/lib/supabase/server";
import { ACTIVE_ORG_COOKIE, pickActiveOrg, sortMemberships, type OrgMembership } from "./active-org";
import {
  parseScope,
  scopeOptions,
  type MembershipRole,
  type Scope,
  type ScopeOption,
  type VisibleLocation,
  type VisibleRegion,
} from "./scope";

const ROLES: readonly MembershipRole[] = ["org_admin", "region_manager", "location_manager", "staff"];

export interface ScopeContext {
  /** Organización activa (null: la persona no tiene ninguna, o están suspendidas). */
  organization: { id: string; name: string } | null;
  /** Todas sus organizaciones, por nombre, para el selector. */
  organizations: { id: string; name: string }[];
  /** Su rol en la organización activa. */
  role: MembershipRole | null;
  regions: VisibleRegion[];
  locations: VisibleLocation[];
  options: ScopeOption[];
}

/**
 * Organizaciones de la persona y la activa (cookie validada contra sus
 * memberships: active-org.ts). Una organización suspendida no aparece: RLS no
 * deja leerla (org_is_active), así que su membership no trae nombre.
 */
export const getOrgContext = cache(async (): Promise<{ active: OrgMembership | null; memberships: OrgMembership[] }> => {
  const [supabase, user, cookieStore] = await Promise.all([createClient(), getCurrentUser(), cookies()]);
  if (!user) return { active: null, memberships: [] };
  const { data, error } = await fetchAll((from, to) =>
    supabase
      .from("memberships")
      .select("organization_id, role, organization:organizations(name, default_locale)")
      .eq("user_id", user.id)
      .order("id")
      .range(from, to),
  );
  if (error) throw new Error("No se pudieron cargar tus organizaciones", { cause: error });
  const memberships = data.flatMap((m): OrgMembership[] => {
    const role = ROLES.find((candidate) => candidate === m.role);
    const organization = m.organization as { name: string; default_locale: string } | null;
    return role && organization
      ? [{ organizationId: m.organization_id, organizationName: organization.name, role, defaultLocale: organization.default_locale }]
      : [];
  });
  return { active: pickActiveOrg(memberships, cookieStore.get(ACTIVE_ORG_COOKIE)?.value), memberships: sortMemberships(memberships) };
});

/**
 * Regiones, locales y rol del usuario en la organización activa, leídos con su
 * JWT (RLS): el selector de alcance solo puede ofrecer lo que el usuario ya ve.
 * Una vez por petición.
 */
export const getScopeContext = cache(async (): Promise<ScopeContext> => {
  const [supabase, orgs, t] = await Promise.all([createClient(), getOrgContext(), getTranslations("scope")]);
  const organizations = orgs.memberships.map((m) => ({ id: m.organizationId, name: m.organizationName }));
  const active = orgs.active;
  if (!active) return { organization: null, organizations, role: null, regions: [], locations: [], options: [] };

  const [regionsResult, locationsResult] = await Promise.all([
    fetchAll((from, to) =>
      supabase.from("regions").select("id, name").eq("organization_id", active.organizationId).order("id").range(from, to),
    ),
    fetchAll((from, to) =>
      supabase
        .from("locations")
        .select("id, name, region_id")
        .eq("organization_id", active.organizationId)
        .order("id")
        .range(from, to),
    ),
  ]);
  const error = regionsResult.error ?? locationsResult.error;
  if (error) throw new Error("No se pudo cargar el alcance", { cause: error });

  const role = active.role;
  const regions = regionsResult.data.map((region) => ({ id: region.id, name: region.name }));
  const locations = locationsResult.data.map((location) => ({
    id: location.id,
    name: location.name,
    regionId: location.region_id,
  }));
  const options = scopeOptions(role, regions, locations, { organization: t("organization"), mine: t("mine") });
  return { organization: { id: active.organizationId, name: active.organizationName }, organizations, role, regions, locations, options };
});

/** Alcance pedido en la URL, validado contra lo que el usuario ve. */
export async function resolveScope(raw: string | string[] | undefined): Promise<{ scope: Scope; context: ScopeContext }> {
  const context = await getScopeContext();
  return { scope: parseScope(raw, context.options), context };
}
