import { createHash } from "node:crypto";

// Quien convierte texto en vectores. El real pasa por el enrutador de modelos
// (tarea embed, clave lógica embedding; ADR 0033) y llega cuando haya un
// proveedor activo y una eval que lo elija (MANUAL §18). El modelo y la
// dimensión se guardan con cada fragmento (ADR 0025 §3): una consulta solo
// compara vectores del mismo modelo.

export interface Embedder {
  /** Identificador del modelo, tal y como se guarda en knowledge_chunks.embedding_model. */
  readonly model: string;
  readonly dim: number;
  embed(texts: readonly string[]): Promise<number[][]>;
}

export class EmbeddingError extends Error {
  override name = "EmbeddingError";
}

/** Un vector que se puede guardar y comparar: la dimensión del modelo y solo números finitos. */
export function assertEmbedding(vector: readonly number[], dim: number): void {
  if (vector.length !== dim) throw new EmbeddingError(`el embedding tiene ${vector.length} dimensiones y el modelo ${dim}`);
  if (!vector.every(Number.isFinite)) throw new EmbeddingError("el embedding tiene valores no finitos");
}

/**
 * Embeddings falsos y deterministas para tests y evals: una bolsa de palabras
 * con hash, normalizada. Textos con palabras en común quedan cerca.
 */
export function createFakeEmbedder(dim = 16): Embedder {
  return {
    model: `fake-hash-${dim}`,
    dim,
    embed(texts) {
      return Promise.resolve(
        texts.map((text) => {
          const vector = new Array<number>(dim).fill(0);
          for (const word of text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []) {
            const index = createHash("sha256").update(word).digest().readUInt32BE(0) % dim;
            vector[index] = (vector[index] ?? 0) + 1;
          }
          const norm = Math.hypot(...vector) || 1;
          return vector.map((value) => value / norm);
        }),
      );
    },
  };
}
