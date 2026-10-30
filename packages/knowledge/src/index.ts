// Conocimiento del negocio (MANUAL §6.1, ADR 0037 sobre el 0025): una sola
// interfaz de recuperación (KnowledgeRetriever) con pgvector como motor de
// ahora. La ingesta (troceado y embeddings en el worker) llega con las
// primeras fuentes reales.
export { KnowledgeQueryError, MAX_K, MAX_QUERY_CHARS, SOURCE_TYPES, assertValidQuery } from "./retriever.js";
export type { KnowledgeHit, KnowledgeQuery, KnowledgeRetriever, KnowledgeScope, SourceType } from "./retriever.js";
export { EmbeddingError, assertEmbedding, createFakeEmbedder } from "./embedder.js";
export type { Embedder } from "./embedder.js";
export { createPgvectorRetriever } from "./pgvector.js";
export type { ChunkRow, ChunkSearch, PgvectorRetrieverOptions } from "./pgvector.js";
