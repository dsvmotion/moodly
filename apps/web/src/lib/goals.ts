import type { MembershipRole, Scope, VisibleLocation, VisibleRegion } from "./scope";

// Objetivos del negocio (MANUAL §6.3, unidad OA19): qué quiere conseguir la
// organización, medido con qué métrica, para cuándo y en qué alcance. Lógica
// pura de la pantalla. Quién gestiona qué es lo mismo que dicen las políticas
// de goals (migración 20261023190000_goals): la pantalla solo ofrece lo que se
// podrá guardar; la barrera sigue siendo RLS.

export const GOAL_SCOPES = ["organization", "region", "location"] as const;
export type GoalScope = (typeof GOAL_SCOPES)[number];

export const GOAL_DIRECTIONS = ["at_least", "at_most"] as const;
export type GoalDirection = (typeof GOAL_DIRECTIONS)[number];

export const GOAL_PERIODS = ["week", "month", "quarter", "year", "once"] as const;
export type GoalPeriod = (typeof GOAL_PERIODS)[number];

export const GOAL_STATUSES = ["active", "paused", "achieved", "missed", "archived"] as const;
export type GoalStatus = (typeof GOAL_STATUSES)[number];

export type GoalUnit = "count" | "percent" | "minutes" | "eur";

/**
 * Las métricas que se pueden elegir (los ejemplos del §6.3). Las claves cumplen
 * el CHECK de goals.metric_key. Medirlas es de la plataforma (goal_progress):
 * aquí solo se eligen. `id` es la clave de sus textos (los mensajes no admiten
 * puntos en la clave).
 */
export const GOAL_METRICS = [
  { key: "appointments.booked", id: "appointmentsBooked", unit: "count", direction: "at_least" },
  { key: "leads.qualified", id: "leadsQualified", unit: "count", direction: "at_least" },
  { key: "conversations.resolved_autonomously", id: "resolvedAutonomously", unit: "percent", direction: "at_least" },
  { key: "response.first_reply_minutes", id: "firstReplyMinutes", unit: "minutes", direction: "at_most" },
  { key: "invoices.outstanding_eur", id: "outstandingInvoices", unit: "eur", direction: "at_most" },
] as const satisfies readonly { key: string; id: string; unit: GoalUnit; direction: GoalDirection }[];

export type GoalMetricKey = (typeof GOAL_METRICS)[number]["key"];
export const GOAL_METRIC_KEYS = GOAL_METRICS.map((metric) => metric.key) as [GoalMetricKey, ...GoalMetricKey[]];

export interface GoalMetricInfo {
  key: string;
  /** null: una métrica que la app no conoce (se enseña con su clave). */
  id: string | null;
  unit: GoalUnit;
  direction: GoalDirection;
  known: boolean;
}

export function goalMetric(key: string): GoalMetricInfo {
  const metric = GOAL_METRICS.find((candidate) => candidate.key === key);
  return metric ? { ...metric, known: true } : { key, id: null, unit: "count", direction: "at_least", known: false };
}

/** La forma de goals.metric_key (su CHECK). */
export const METRIC_KEY_PATTERN = /^[a-z][a-z0-9_]{0,62}(\.[a-z][a-z0-9_]{0,62}){0,2}$/;

/**
 * Las métricas que ofrece el selector. Si el objetivo ya tiene una que la app
 * no conoce (la puso la plataforma u otra versión), sale la primera: cambiar
 * otro campo no la reescribe con la primera del catálogo.
 */
export function goalMetricOptions(current: string | null): string[] {
  return current !== null && !goalMetric(current).known ? [current, ...GOAL_METRIC_KEYS] : [...GOAL_METRIC_KEYS];
}

export interface GoalScopeRef {
  scope: GoalScope;
  scopeId: string;
}

/** Un alcance donde la persona puede crear objetivos, con su nombre. */
export interface GoalTarget extends GoalScopeRef {
  /** null: toda la organización (el texto lo pone la pantalla). */
  name: string | null;
}

export function targetValue(target: GoalScopeRef): string {
  return `${target.scope}:${target.scopeId}`;
}

const TARGET_PATTERN = /^(organization|region|location):([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

/** El alcance que llega del formulario («region:<uuid>»), o null si no lo es. */
export function parseTargetValue(value: unknown): GoalScopeRef | null {
  if (typeof value !== "string") return null;
  const [, scope, scopeId] = TARGET_PATTERN.exec(value) ?? [];
  if (!scope || !scopeId) return null;
  return { scope: scope as GoalScope, scopeId: scopeId.toLowerCase() };
}

/**
 * Dónde puede crear y cambiar objetivos la persona (políticas goals_insert,
 * goals_update y goals_delete):
 * - org_admin, con el segundo factor: toda la organización, cada región y cada local;
 * - region_manager: sus regiones y los locales de ellas;
 * - location_manager: sus locales;
 * - staff: ninguno (solo lee).
 * `regions` y `locations` son los que la persona ve (RLS): a un region_manager
 * solo le llegan sus regiones; a un location_manager, la región de su local,
 * que no gestiona.
 */
export function manageableTargets({
  role,
  aal2,
  organization,
  regions,
  locations,
}: {
  role: MembershipRole | null;
  aal2: boolean;
  organization: { id: string } | null;
  regions: readonly VisibleRegion[];
  locations: readonly VisibleLocation[];
}): GoalTarget[] {
  if (!organization) return [];
  const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, "es");
  const regionTargets = (list: readonly VisibleRegion[]) =>
    [...list].sort(byName).map((region): GoalTarget => ({ scope: "region", scopeId: region.id, name: region.name }));
  const locationTargets = (list: readonly VisibleLocation[]) =>
    [...list].sort(byName).map((location): GoalTarget => ({ scope: "location", scopeId: location.id, name: location.name }));

  if (role === "org_admin") {
    if (!aal2) return [];
    return [
      { scope: "organization", scopeId: organization.id, name: null },
      ...regionTargets(regions),
      ...locationTargets(locations),
    ];
  }
  if (role === "region_manager") {
    const own = new Set(regions.map((region) => region.id));
    return [
      ...regionTargets(regions),
      ...locationTargets(locations.filter((location) => location.regionId !== null && own.has(location.regionId))),
    ];
  }
  if (role === "location_manager") return locationTargets(locations);
  return [];
}

export function canManageGoal(goal: GoalScopeRef, targets: readonly GoalScopeRef[]): boolean {
  return targets.some((target) => target.scope === goal.scope && target.scopeId === goal.scopeId);
}

/**
 * Los objetivos que se aplican al alcance elegido en el selector:
 * - toda la organización: todos los que se ven;
 * - una región: los de la organización, los de la región y los de sus locales;
 * - un local: los de la organización, los de su región y los del local.
 */
export function goalsInScope<T extends GoalScopeRef>(goals: readonly T[], scope: Scope, locations: readonly VisibleLocation[]): T[] {
  if (scope.kind === "all") return [...goals];
  const regionOf = new Map(locations.map((location) => [location.id, location.regionId]));
  if (scope.kind === "region") {
    return goals.filter(
      (goal) =>
        goal.scope === "organization" ||
        (goal.scope === "region" && goal.scopeId === scope.regionId) ||
        (goal.scope === "location" && regionOf.get(goal.scopeId) === scope.regionId),
    );
  }
  const regionId = regionOf.get(scope.locationId) ?? null;
  return goals.filter(
    (goal) =>
      goal.scope === "organization" ||
      (goal.scope === "region" && regionId !== null && goal.scopeId === regionId) ||
      (goal.scope === "location" && goal.scopeId === scope.locationId),
  );
}
