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
  /**
   * Lo mismo, con lo que costó (el libro de consumo, PL-ledger): quien indexa lo
   * anota. Opcional: un embedder sin coste que contar no lo tiene.
   */
  embedWithUsage?(texts: readonly string[]): Promise<EmbedResult>;
}

/** Lo que costó sacar unos embeddings: tokens de entrada y euros a precio de lista. */
export interface EmbeddingUsage {
  tokens: number;
  costEur: number;
}

export interface EmbedResult {
  vectors: number[][];
  usage: EmbeddingUsage;
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
  const words = (text: string) => text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  const embed = (texts: readonly string[]) =>
    texts.map((text) => {
      const vector = new Array<number>(dim).fill(0);
      for (const word of words(text)) {
        const index = createHash("sha256").update(word).digest().readUInt32BE(0) % dim;
        vector[index] = (vector[index] ?? 0) + 1;
      }
      const norm = Math.hypot(...vector) || 1;
      return vector.map((value) => value / norm);
    });
  return {
    model: `fake-hash-${dim}`,
    dim,
    embed(texts) {
      return Promise.resolve(embed(texts));
    },
    // Una palabra, un token; no cuesta nada.
    embedWithUsage(texts) {
      return Promise.resolve({ vectors: embed(texts), usage: { tokens: texts.reduce((sum, text) => sum + words(text).length, 0), costEur: 0 } });
    },
  };
}
