import { fetchAll } from "@/lib/supabase/fetch-all";
import { createClient } from "@/lib/supabase/server";
import { locationsInScope, type Scope } from "@/lib/scope";
import type { ScopeContext } from "@/lib/scope-data";

// Las fuentes de conocimiento de la organización activa (paso B20-3, MANUAL
// §6.1). Se leen con la sesión: RLS (knowledge_sources_select) enseña las de
// toda la organización a cualquiera de ella y las de un local a quien tiene ese
// local. Aquí solo se acota al alcance elegido: las de toda la organización
// salen siempre, porque los agentes de cualquier local las usan.

export const SOURCE_STATUSES = ["pending", "processing", "ready", "error"] as const;
export type SourceStatus = (typeof SOURCE_STATUSES)[number];

export interface KnowledgeSourceRow {
  id: string;
  type: string;
  title: string;
  body: string | null;
  status: SourceStatus;
  locationId: string | null;
  /** null: toda la organización. */
  location: string | null;
  updatedAt: string;
}

const isStatus = (value: string): value is SourceStatus => (SOURCE_STATUSES as readonly string[]).includes(value);

export async function loadKnowledgeSources(scope: Scope, context: ScopeContext): Promise<KnowledgeSourceRow[]> {
  const organization = context.organization;
  if (!organization) return [];
  const supabase = await createClient();
  const { data, error } = await fetchAll((from, to) =>
    supabase
      .from("knowledge_sources")
      .select("id, type, title, body, status, location_id, updated_at")
      .eq("organization_id", organization.id)
      .order("id")
      .range(from, to),
  );
  if (error) throw new Error("No se pudieron cargar las fuentes de conocimiento", { cause: error });

  const inScope = new Set(locationsInScope(scope, context.locations).map((location) => location.id));
  const names = new Map(context.locations.map((location) => [location.id, location.name]));
  return data
    .filter((row) => row.location_id === null || inScope.has(row.location_id))
    .map((row) => ({
      id: row.id,
      type: row.type,
      title: row.title,
      body: row.body,
      // Un estado que la app no conoce se trata como pendiente: no se usa hasta estar ready.
      status: isStatus(row.status) ? row.status : "pending",
      locationId: row.location_id,
      location: row.location_id ? (names.get(row.location_id) ?? null) : null,
      updatedAt: row.updated_at,
    }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
