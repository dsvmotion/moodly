// Alcance de la vista (MANUAL §9.2): toda la organización, una región o un
// local. Vive en la URL (?scope=) y solo puede apuntar a lo que el usuario ve
// según RLS; cualquier otro valor cae a "all". Lógica pura, probada aparte.
// El alcance acota lo que ya se ve: la barrera de datos sigue siendo RLS.

export const SCOPE_PARAM = "scope";

export type MembershipRole = "org_admin" | "region_manager" | "location_manager" | "staff";

export interface VisibleRegion {
  id: string;
  name: string;
}

export interface VisibleLocation {
  id: string;
  name: string;
  regionId: string | null;
}

export interface ScopeOption {
  value: string;
  label: string;
  kind: "all" | "region" | "location";
}

export type Scope = { kind: "all" } | { kind: "region"; regionId: string } | { kind: "location"; locationId: string };

export function scopeValue(scope: Scope): string {
  if (scope.kind === "region") return `region:${scope.regionId}`;
  if (scope.kind === "location") return `location:${scope.locationId}`;
  return "all";
}

/**
 * Opciones del selector. Las regiones solo se ofrecen a quien trabaja por
 * regiones (org_admin y region_manager); los locales, siempre los visibles.
 */
export function scopeOptions(
  role: MembershipRole | null,
  regions: readonly VisibleRegion[],
  locations: readonly VisibleLocation[],
  labels: { organization: string; mine: string },
): ScopeOption[] {
  const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, "es");
  const all: ScopeOption = { value: "all", label: role === "org_admin" ? labels.organization : labels.mine, kind: "all" };
  const regionOptions =
    role === "org_admin" || role === "region_manager"
      ? [...regions].sort(byName).map((r): ScopeOption => ({ value: `region:${r.id}`, label: r.name, kind: "region" }))
      : [];
  const locationOptions = [...locations]
    .sort(byName)
    .map((l): ScopeOption => ({ value: `location:${l.id}`, label: l.name, kind: "location" }));
  return [all, ...regionOptions, ...locationOptions];
}

/** Interpreta ?scope= y lo valida contra las opciones visibles. */
export function parseScope(value: unknown, options: readonly ScopeOption[]): Scope {
  if (typeof value !== "string" || !options.some((option) => option.value === value)) return { kind: "all" };
  const [kind, id] = value.split(":");
  if (kind === "region" && id) return { kind: "region", regionId: id };
  if (kind === "location" && id) return { kind: "location", locationId: id };
  return { kind: "all" };
}

/** Locales que entran en el alcance. */
export function locationsInScope<T extends VisibleLocation>(scope: Scope, locations: readonly T[]): T[] {
  if (scope.kind === "region") return locations.filter((location) => location.regionId === scope.regionId);
  if (scope.kind === "location") return locations.filter((location) => location.id === scope.locationId);
  return [...locations];
}

export interface ScopedMembership {
  role: MembershipRole | string;
  scopeRegionIds: readonly string[];
  scopeLocationIds: readonly string[];
}

/**
 * ¿La persona tiene acceso a algo dentro del alcance? org_admin cubre toda la
 * organización; region_manager, los locales de sus regiones; location_manager
 * y staff, sus locales.
 */
export function membershipInScope(
  membership: ScopedMembership,
  scope: Scope,
  locations: readonly VisibleLocation[],
): boolean {
  if (scope.kind === "all" || membership.role === "org_admin") return true;
  const scoped = locationsInScope(scope, locations);
  const scopedIds = new Set(scoped.map((location) => location.id));
  const scopedRegions = new Set(
    scope.kind === "region" ? [scope.regionId] : scoped.map((location) => location.regionId).filter((id): id is string => id !== null),
  );
  return (
    membership.scopeLocationIds.some((id) => scopedIds.has(id)) ||
    membership.scopeRegionIds.some((id) => scopedRegions.has(id))
  );
}

/** Añade o quita ?scope= de un href conservando el resto de parámetros. */
export function withScope(href: string, scopeValueOrNull: string | null): string {
  const [path = "", query = ""] = href.split("?");
  const params = new URLSearchParams(query);
  if (scopeValueOrNull && scopeValueOrNull !== "all") params.set(SCOPE_PARAM, scopeValueOrNull);
  else params.delete(SCOPE_PARAM);
  const search = params.toString();
  return search ? `${path}?${search}` : path;
}
