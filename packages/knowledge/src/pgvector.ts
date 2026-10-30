import { assertEmbedding } from "./embedder.js";
import type { Embedder } from "./embedder.js";
import { SOURCE_TYPES, assertValidQuery } from "./retriever.js";
import type { KnowledgeHit, KnowledgeRetriever, SourceType } from "./retriever.js";

// El motor de ahora: search_knowledge en Postgres (escalón de búsqueda exacta
// del ADR 0025, híbrida con RRF). Este paquete no habla con la base de datos:
// recibe la búsqueda ya acotada a una organización (en el worker,
// createServiceDb().forOrganization(org).searchKnowledge, de @repo/db).

/** Una fila de search_knowledge. */
export interface ChunkRow {
  chunk_id: string;
  source_id: string;
  source_type: string;
  source_title: string;
  content: string;
  score: number;
}

/** La búsqueda de UNA organización: el organization_id ya va dentro. */
export type ChunkSearch = (params: {
  locationId: string | null;
  embeddingModel: string;
  queryEmbedding: readonly number[];
  query: string;
  k: number;
}) => Promise<readonly ChunkRow[]>;

export interface PgvectorRetrieverOptions {
  /** La búsqueda acotada a la organización del alcance. */
  forOrganization(organizationId: string): ChunkSearch;
  embedder: Embedder;
}

function sourceType(value: string): SourceType {
  if (!(SOURCE_TYPES as readonly string[]).includes(value)) throw new Error(`tipo de fuente desconocido: ${value}`);
  return value as SourceType;
}

export function createPgvectorRetriever({ forOrganization, embedder }: PgvectorRetrieverOptions): KnowledgeRetriever {
  return {
    async search(query) {
      assertValidQuery(query);
      const [queryEmbedding] = await embedder.embed([query.query]);
      if (!queryEmbedding) throw new Error("el embedder no devolvió el vector de la consulta");
      assertEmbedding(queryEmbedding, embedder.dim);

      const rows = await forOrganization(query.scope.organizationId)({
        locationId: query.scope.locationId,
        embeddingModel: embedder.model,
        queryEmbedding,
        query: query.query,
        k: query.k,
      });
      return rows.slice(0, query.k).map(
        (row): KnowledgeHit => ({
          untrusted: true,
          source: `knowledge:${row.source_id}`,
          chunkId: row.chunk_id,
          content: row.content,
          score: row.score,
          citation: { sourceId: row.source_id, type: sourceType(row.source_type), title: row.source_title },
        }),
      );
    },
  };
}
