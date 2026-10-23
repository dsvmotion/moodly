import "server-only";
import { getTranslations } from "next-intl/server";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { isAgentOrigin, isAgentStatus, sortAgentRows, toAgentView, type AgentView } from "./agents";

/**
 * Agentes de la organización activa, del catálogo (ADR 0030): RLS decide cuáles
 * existen (los de su organización). Los de serie se traducen por clave; los
 * propios llevan su nombre y su descripción. Una vez por petición.
 * El detalle de un error va en `cause` (para los logs), no en el mensaje.
 */
export const getOrgAgents = cache(async (organizationId: string | null): Promise<AgentView[]> => {
  if (!organizationId) return [];
  const supabase = await createClient();
  const [{ data, error }, tNames, tDescriptions] = await Promise.all([
    supabase
      .from("agents")
      .select("status, display_name, type:agent_types!inner(id, key, origin, name, description, color)")
      .eq("organization_id", organizationId),
    getTranslations("nav.agentTypes"),
    getTranslations("agentPage.descriptions"),
  ]);
  if (error) throw new Error("No se pudieron cargar los agentes", { cause: error });

  const rows = data.map((agent) => {
    if (!isAgentStatus(agent.status) || !isAgentOrigin(agent.type.origin)) {
      throw new Error("Un agente tiene un estado u origen desconocido");
    }
    return {
      key: agent.type.key,
      origin: agent.type.origin,
      typeId: agent.type.id,
      name: agent.type.name,
      description: agent.type.description,
      color: agent.type.color,
      status: agent.status,
      displayName: agent.display_name,
    };
  });
  return sortAgentRows(rows).map((row) =>
    toAgentView(row, {
      label: tNames.has(row.key) ? tNames(row.key) : undefined,
      description: tDescriptions.has(row.key) ? tDescriptions(row.key) : undefined,
    }),
  );
});

/** Un agente de la organización activa por su clave, o null si no lo tiene. */
export async function getOrgAgent(organizationId: string | null, key: string): Promise<AgentView | null> {
  const agents = await getOrgAgents(organizationId);
  return agents.find((agent) => agent.key === key) ?? null;
}
