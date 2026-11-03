import { createClient } from "@/lib/supabase/server";
import { locationsInScope, type Scope } from "@/lib/scope";
import type { ScopeContext } from "@/lib/scope-data";

// Lo que el agente dejó esperando a una persona (paso 4d-3d, MANUAL §5.7). Se
// lee con la sesión: RLS (approvals_select) solo deja ver las de los locales
// del alcance de cada persona, y las de toda la organización a un org_admin.
// Aquí solo se filtra por el alcance elegido en el selector.

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

export async function loadPendingApprovals(scope: Scope, context: ScopeContext): Promise<ApprovalRow[]> {
  const organization = context.organization;
  if (!organization) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("approvals")
    .select("id, reason, effect_class, location_id, created_at, expires_at, execution:executions(skill_key)")
    .eq("organization_id", organization.id)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: true })
    .limit(200);
  if (error) throw new Error("No se pudieron cargar las aprobaciones", { cause: error });

  const inScope = new Set(locationsInScope(scope, context.locations).map((location) => location.id));
  const names = new Map(context.locations.map((location) => [location.id, location.name]));
  return data
    .filter((row) => (row.location_id === null ? scope.kind === "all" : inScope.has(row.location_id)))
    .map((row) => ({
      id: row.id,
      summary: row.reason ?? "",
      skillKey: row.execution?.skill_key ?? "",
      effectClass: row.effect_class,
      location: row.location_id ? (names.get(row.location_id) ?? null) : null,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
    }));
}
