// Conocimiento del negocio (MANUAL §6.1, ADR 0037 sobre el 0025): una sola
// interfaz de recuperación (KnowledgeRetriever) con pgvector como motor de
// ahora. El troceado de las fuentes de texto vive aquí; la ingesta (trocear,
// embeddings y guardar) la hace el worker (paso B20-1, ADR 0048).
export { KnowledgeQueryError, MAX_K, MAX_QUERY_CHARS, SOURCE_TYPES, assertValidQuery } from "./retriever.js";
export type { KnowledgeHit, KnowledgeQuery, KnowledgeRetriever, KnowledgeScope, SourceType } from "./retriever.js";
export { EmbeddingError, assertEmbedding, createFakeEmbedder } from "./embedder.js";
export type { EmbedResult, Embedder, EmbeddingUsage } from "./embedder.js";
export { createPgvectorRetriever } from "./pgvector.js";
export type { ChunkRow, ChunkSearch, PgvectorRetrieverOptions } from "./pgvector.js";
export { MAX_CHUNK_CHARS, chunkText } from "./chunk.js";
