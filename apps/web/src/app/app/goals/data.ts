import { fetchAll } from "@/lib/supabase/fetch-all";
import { createClient } from "@/lib/supabase/server";
import { GOAL_DIRECTIONS, GOAL_PERIODS, GOAL_SCOPES, GOAL_STATUSES, type GoalDirection, type GoalPeriod, type GoalScope, type GoalStatus } from "@/lib/goals";
import type { ScopeContext } from "@/lib/scope-data";

// Los objetivos de la organización activa (OA19, MANUAL §6.3). Se leen con la
// sesión: RLS (goals_select) enseña los de toda la organización a cualquiera
// de ella y los de una región o un local a quien llega a ellos. El alcance
// elegido se aplica después (goalsInScope): una organización tiene pocos
// objetivos, no miles de filas.

export interface GoalRow {
  id: string;
  scope: GoalScope;
  scopeId: string;
  title: string;
  metricKey: string;
  direction: GoalDirection;
  targetValue: number;
  period: GoalPeriod;
  startsOn: string;
  dueDate: string | null;
  status: GoalStatus;
  updatedAt: string;
}

const oneOf =
  <T extends string>(list: readonly T[]) =>
  (value: string): value is T =>
    (list as readonly string[]).includes(value);
const isScope = oneOf(GOAL_SCOPES);
const isDirection = oneOf(GOAL_DIRECTIONS);
const isPeriod = oneOf(GOAL_PERIODS);
const isStatus = oneOf(GOAL_STATUSES);

export async function loadGoals(context: ScopeContext): Promise<GoalRow[]> {
  const organization = context.organization;
  if (!organization) return [];
  const supabase = await createClient();
  const { data, error } = await fetchAll((from, to) =>
    supabase
      .from("goals")
      .select("id, scope, scope_id, title, metric_key, direction, target_value, period, starts_on, due_date, status, updated_at")
      .eq("organization_id", organization.id)
      .order("id")
      .range(from, to),
  );
  if (error) throw new Error("No se pudieron cargar los objetivos", { cause: error });

  // Los CHECK de la tabla ya limitan estos valores; si llegara otro, la fila no se enseña.
  return data.flatMap((row): GoalRow[] =>
    isScope(row.scope) && isDirection(row.direction) && isPeriod(row.period) && isStatus(row.status)
      ? [
          {
            id: row.id,
            scope: row.scope,
            scopeId: row.scope_id,
            title: row.title,
            metricKey: row.metric_key,
            direction: row.direction,
            targetValue: Number(row.target_value),
            period: row.period,
            startsOn: row.starts_on,
            dueDate: row.due_date,
            status: row.status,
            updatedAt: row.updated_at,
          },
        ]
      : [],
  );
}
