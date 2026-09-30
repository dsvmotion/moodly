import "server-only";
import { getTranslations } from "next-intl/server";
import { cache } from "react";
import { getCurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
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
  role: MembershipRole | null;
  regions: VisibleRegion[];
  locations: VisibleLocation[];
  options: ScopeOption[];
}

/**
 * Regiones, locales y rol del usuario, leídos con su JWT (RLS): el selector
 * de alcance solo puede ofrecer lo que el usuario ya ve. Una vez por petición.
 */
export const getScopeContext = cache(async (): Promise<ScopeContext> => {
  const [supabase, user, t] = await Promise.all([createClient(), getCurrentUser(), getTranslations("scope")]);
  const [regionsResult, locationsResult, membershipResult] = await Promise.all([
    supabase.from("regions").select("id, name"),
    supabase.from("locations").select("id, name, region_id"),
    user
      ? supabase.from("memberships").select("role").eq("user_id", user.id).limit(1).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  const error = regionsResult.error ?? locationsResult.error ?? membershipResult.error;
  if (error) throw new Error(`No se pudo cargar el alcance: ${error.message}`);

  const rawRole = membershipResult.data?.role;
  const role = ROLES.find((candidate) => candidate === rawRole) ?? null;
  const regions = (regionsResult.data ?? []).map((region) => ({ id: region.id, name: region.name }));
  const locations = (locationsResult.data ?? []).map((location) => ({
    id: location.id,
    name: location.name,
    regionId: location.region_id,
  }));
  const options = scopeOptions(role, regions, locations, { organization: t("organization"), mine: t("mine") });
  return { role, regions, locations, options };
});

/** Alcance pedido en la URL, validado contra lo que el usuario ve. */
export async function resolveScope(raw: string | string[] | undefined): Promise<{ scope: Scope; context: ScopeContext }> {
  const context = await getScopeContext();
  return { scope: parseScope(raw, context.options), context };
}
