import type { TenantDb } from "@repo/db/service";
import { createPgvectorRetriever } from "@repo/knowledge";
import type { Embedder, KnowledgeRetriever } from "@repo/knowledge";

// El conocimiento del negocio para las skills del worker (paso B20-2, ADR 0037):
// search_knowledge con la organización de este acceso (tenantDb), nunca con
// otra. Si el alcance de una búsqueda pide otra organización, falla en vez de
// buscar (control 3.1: el runtime y los datos tienen que coincidir).

export class KnowledgeScopeError extends Error {
  override name = "KnowledgeScopeError";
}

export function createKnowledgeRetriever(db: TenantDb, embedder: Embedder): KnowledgeRetriever {
  return createPgvectorRetriever({
    embedder,
    forOrganization(organizationId) {
      if (organizationId !== db.organizationId) throw new KnowledgeScopeError("la búsqueda pide otra organización que la de este acceso");
      return (params) => db.searchKnowledge(params);
    },
  });
}
