import { createClient } from "@/lib/supabase/server";
import { decidableRoles } from "@/lib/needs-you";
import { locationFilter, type Scope } from "@/lib/scope";
import type { ScopeContext } from "@/lib/scope-data";

// Lo que el agente dejó esperando a una persona (paso 4d-3d, MANUAL §5.7). Se
// lee con la sesión: RLS (approvals_select) solo deja ver las de los locales
// del alcance de cada persona, y las de toda la organización a un org_admin.
// Aquí se filtra por el alcance elegido en el selector, en la consulta: la
// lista tiene tope y lo que se filtrase después dejaría fuera filas (auditoría
// de preproducción, M-07). Y solo las que la persona puede decidir por su rol
// (decidableRoles, la regla de private.can_decide_approval): el staff no ve
// las que piden un encargado, que no le esperan a él. Es la misma cuenta que
// el contador de la barra lateral (revisión de V10 sobre #178).

/** Cuántas pendientes enseña la lista: las más antiguas. Al decidirlas entran las siguientes. */
export const APPROVALS_LIMIT = 200;

export interface ApprovalRow {
  id: string;
  /** Lo que verá quien decide: la vista previa de la skill. */
  summary: string;
  skillKey: string;
  effectClass: string;
  location: string | null;
  createdAt: string;
  expiresAt: string;
}

export interface PendingApprovals {
  rows: ApprovalRow[];
  /** Hay más pendientes que las que se muestran. */
  truncated: boolean;
  /** Cuántas hay en total en el alcance, también las que no caben en la lista (M-02). */
  total: number;
}

export async function loadPendingApprovals(scope: Scope, context: ScopeContext): Promise<PendingApprovals> {
  const organization = context.organization;
  if (!organization) return { rows: [], truncated: false, total: 0 };
  const locations = locationFilter(scope, context.locations);
  if (locations.kind === "only" && locations.locationIds.length === 0) return { rows: [], truncated: false, total: 0 };

  const supabase = await createClient();
  // Una fila de más: si llega, hay más pendientes de las que se muestran.
  let query = supabase
    .from("approvals")
    .select("id, reason, effect_class, location_id, created_at, expires_at, execution:executions(skill_key)", { count: "exact" })
    .eq("organization_id", organization.id)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .in("required_role", decidableRoles(context.role))
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(APPROVALS_LIMIT + 1);
  if (locations.kind === "only") query = query.in("location_id", locations.locationIds);
  const { data, error, count } = await query;
  if (error) throw new Error("No se pudieron cargar las aprobaciones", { cause: error });

  const names = new Map(context.locations.map((location) => [location.id, location.name]));
  return {
    rows: data.slice(0, APPROVALS_LIMIT).map((row) => ({
      id: row.id,
      summary: row.reason ?? "",
      skillKey: row.execution?.skill_key ?? "",
      effectClass: row.effect_class,
      location: row.location_id ? (names.get(row.location_id) ?? null) : null,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
    })),
    truncated: data.length > APPROVALS_LIMIT,
    total: count ?? data.length,
  };
}
