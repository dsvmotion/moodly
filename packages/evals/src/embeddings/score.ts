import type { EmbeddingEvalChunk, EmbeddingEvalQuery } from "./dataset.js";

// La eval de embeddings del conocimiento (ADR 0048): con cada modelo, cada
// pregunta contra todos los fragmentos por similitud coseno, y en qué puesto
// sale el primer fragmento que la contesta. Solo la parte semántica de
// search_knowledge (sin el texto completo): lo que cambia de un modelo a otro.

export interface EmbedFn {
  embed(texts: readonly string[]): Promise<number[][]>;
}

export interface EmbeddingEvalResult {
  /** Fracción de preguntas cuyo fragmento sale el primero. */
  recallAt1: number;
  /** Fracción de preguntas cuyo fragmento sale entre los tres primeros. */
  recallAt3: number;
  /** Media de 1 / puesto del primer fragmento que la contesta. */
  mrr: number;
  /** Las preguntas cuyo fragmento no salió el primero: qué salió y en qué puesto quedó el bueno. */
  misses: { q: string; top: string; rank: number }[];
}

function cosine(a: readonly number[], b: readonly number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i += 1) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  return na === 0 || nb === 0 ? 0 : dot / Math.sqrt(na * nb);
}

/** Puntúa unos vectores ya calculados: uno por fragmento y uno por pregunta, en el mismo orden. */
export function scoreRetrieval(
  chunks: readonly EmbeddingEvalChunk[],
  queries: readonly EmbeddingEvalQuery[],
  chunkVectors: readonly (readonly number[])[],
  queryVectors: readonly (readonly number[])[],
): EmbeddingEvalResult {
  if (chunkVectors.length !== chunks.length || queryVectors.length !== queries.length) throw new Error("no hay un vector por texto");
  if (queries.length === 0) throw new Error("sin preguntas");
  let at1 = 0;
  let at3 = 0;
  let reciprocal = 0;
  const misses: EmbeddingEvalResult["misses"] = [];
  queries.forEach((query, qi) => {
    const qv = queryVectors[qi] ?? [];
    // Empate: el orden del set, para que el resultado no dependa de sort.
    const order = chunks
      .map((chunk, ci) => ({ id: chunk.id, score: cosine(qv, chunkVectors[ci] ?? []), ci }))
      .sort((a, b) => b.score - a.score || a.ci - b.ci)
      .map((entry) => entry.id);
    const positions = query.gold.map((id) => order.indexOf(id)).filter((position) => position >= 0);
    if (positions.length === 0) throw new Error(`la pregunta «${query.q}» no tiene ningún fragmento del set`);
    const rank = Math.min(...positions) + 1;
    if (rank === 1) at1 += 1;
    if (rank <= 3) at3 += 1;
    reciprocal += 1 / rank;
    if (rank > 1) misses.push({ q: query.q, top: order[0] ?? "", rank });
  });
  const n = queries.length;
  return { recallAt1: at1 / n, recallAt3: at3 / n, mrr: reciprocal / n, misses };
}

/** Saca los vectores con un modelo y puntúa. */
export async function runEmbeddingEval(
  embedder: EmbedFn,
  chunks: readonly EmbeddingEvalChunk[],
  queries: readonly EmbeddingEvalQuery[],
): Promise<EmbeddingEvalResult> {
  const chunkVectors = await embedder.embed(chunks.map((chunk) => chunk.text));
  const queryVectors = await embedder.embed(queries.map((query) => query.q));
  return scoreRetrieval(chunks, queries, chunkVectors, queryVectors);
}
