import "server-only";
import type { LocationRow } from "@/components/records/locations-table";
import type { PersonRow } from "@/components/records/people-table";
import { createClient } from "@/lib/supabase/server";
import { locationsInScope, membershipInScope, type Scope } from "./scope";
import type { ScopeContext } from "./scope-data";

// Datos de Registros → Locales y Personas. Consultas normales con el JWT del
// usuario (RLS decide qué filas existen); el alcance acota esas filas.

async function loadMemberships() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("memberships")
    .select("id, role, scope_region_ids, scope_location_ids, user:users(full_name)");
  if (error) throw new Error(`No se pudieron cargar las personas: ${error.message}`);
  return data.map((m) => ({
    id: m.id,
    role: m.role,
    name: m.user.full_name,
    scopeRegionIds: m.scope_region_ids,
    scopeLocationIds: m.scope_location_ids,
  }));
}

export async function loadLocationRows(scope: Scope, context: ScopeContext): Promise<LocationRow[]> {
  const supabase = await createClient();
  const [{ data, error }, memberships] = await Promise.all([
    supabase.from("locations").select("id, name, status, timezone, address, opening_hours, region_id, region:regions(name)"),
    loadMemberships(),
  ]);
  if (error) throw new Error(`No se pudieron cargar los locales: ${error.message}`);

  const rows = data.map((location) => ({ ...location, regionId: location.region_id }));
  return locationsInScope(scope, rows)
    .sort((a, b) => a.name.localeCompare(b.name, "es"))
    .map((location) => ({
      id: location.id,
      name: location.name,
      region: location.region?.name ?? null,
      status: location.status,
      timezone: location.timezone,
      address: location.address,
      openingHours: location.opening_hours,
      // Personas con acceso a este local, entre las que el usuario ve.
      people: memberships
        .filter((m) => membershipInScope(m, { kind: "location", locationId: location.id }, context.locations))
        .map((m) => m.name ?? "")
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, "es")),
    }));
}

export async function loadPersonRows(scope: Scope, context: ScopeContext): Promise<PersonRow[]> {
  const memberships = await loadMemberships();
  const names = new Map<string, string>([
    ...context.regions.map((r): [string, string] => [r.id, r.name]),
    ...context.locations.map((l): [string, string] => [l.id, l.name]),
  ]);
  return memberships
    .filter((m) => membershipInScope(m, scope, context.locations))
    .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "", "es"))
    .map((m) => ({
      id: m.id,
      name: m.name,
      role: m.role,
      // Solo nombres de regiones y locales que el usuario puede ver.
      scope: [...m.scopeRegionIds, ...m.scopeLocationIds].flatMap((id) => names.get(id) ?? []),
    }));
}
