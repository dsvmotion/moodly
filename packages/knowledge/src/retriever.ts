// Una sola interfaz de conocimiento (ADR 0037, sobre el 0025; roadmap §3.5),
// con varios motores detrás: pgvector ahora; el índice del cliente (Azure AI
// Search, Google Agent Search) cuando un cliente lo pida. Venga del motor que
// venga, quien la usa recibe lo mismo: fragmentos con su cita, marcados como
// dato no confiable (control 3.8).

export const SOURCE_TYPES = ["faq", "pricing", "policy", "catalog", "document", "website", "human_answer"] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

/** El alcance de la búsqueda. Lo pone el runtime (RunScope), nunca lo que propone el LLM. */
export interface KnowledgeScope {
  organizationId: string;
  /** null = un run de organización: solo ve lo de toda la organización. */
  locationId: string | null;
}

export interface KnowledgeQuery {
  scope: KnowledgeScope;
  query: string;
  k: number;
}

export interface KnowledgeHit {
  /** Lo que se recupera es dato, no instrucción: así entra al prompt. */
  untrusted: true;
  /** De dónde viene: knowledge:<source_id>. */
  source: string;
  chunkId: string;
  content: string;
  score: number;
  citation: { sourceId: string; type: SourceType; title: string };
}

export interface KnowledgeRetriever {
  search(query: KnowledgeQuery): Promise<KnowledgeHit[]>;
}

export class KnowledgeQueryError extends Error {
  override name = "KnowledgeQueryError";
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const MAX_K = 50; // el mismo tope que search_knowledge
export const MAX_QUERY_CHARS = 2000;

/** Comprueba una consulta antes de gastar un embedding en ella. */
export function assertValidQuery({ scope, query, k }: KnowledgeQuery): void {
  if (!UUID.test(scope.organizationId)) throw new KnowledgeQueryError("organizationId no es un UUID");
  if (scope.locationId !== null && !UUID.test(scope.locationId)) throw new KnowledgeQueryError("locationId no es un UUID");
  if (!Number.isInteger(k) || k < 1 || k > MAX_K) throw new KnowledgeQueryError(`k tiene que ser un entero entre 1 y ${MAX_K}`);
  if (query.trim().length === 0) throw new KnowledgeQueryError("la consulta está vacía");
  if (query.length > MAX_QUERY_CHARS) throw new KnowledgeQueryError(`la consulta pasa de ${MAX_QUERY_CHARS} caracteres`);
}
