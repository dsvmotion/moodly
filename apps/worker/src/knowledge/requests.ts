import type { TenantDb } from "@repo/db/service";
import type { KnowledgeRequestStore } from "@repo/skills";

// Las preguntas al equipo en la base de datos de Moodly (paso B20-4b, sobre la
// tabla de B20-4a). La organización es la de este acceso (tenantDb); el agente
// sale del run, y validate_knowledge_request comprueba que el run, el agente,
// la conversación y el local coinciden. El local la contesta su equipo; sin
// local, un org_admin (la base de datos lo exige igual).

export function createMoodlyKnowledgeRequests(db: TenantDb): KnowledgeRequestStore {
  return {
    async create({ locationId, conversationId, runId, question, idempotencyKey }) {
      const run = await db.from("agent_runs").select("agent_id").eq("id", runId).single();
      if (run.error) throw new Error(`agent_runs: ${run.error.message}`);
      const inserted = await db
        .from("knowledge_requests")
        .insert({
          location_id: locationId,
          agent_id: run.data.agent_id,
          run_id: runId,
          conversation_id: conversationId,
          question,
          assigned_role: locationId ? "staff" : "org_admin",
          idempotency_key: idempotencyKey,
        })
        .select("id")
        .single();
      if (!inserted.error) return { id: inserted.data.id, alreadyAsked: false };
      if (inserted.error.code === "23505") {
        // La misma ejecución otra vez (un reintento): la pregunta que ya dejó.
        const same = await db.from("knowledge_requests").select("id").eq("idempotency_key", idempotencyKey).single();
        if (same.error) throw new Error(`knowledge_requests: ${same.error.message}`);
        return { id: same.data.id, alreadyAsked: true };
      }
      throw new Error(`knowledge_requests: ${inserted.error.message}`);
    },
  };
}
