import { createFakeEmbedder } from "@repo/knowledge";
import { describe, expect, it } from "vitest";
import { EMBEDDING_EVAL_CHUNKS, EMBEDDING_EVAL_QUERIES } from "./dataset.js";
import { runEmbeddingEval, scoreRetrieval } from "./score.js";

// La eval de embeddings sin red: el set es coherente y la puntuación cuenta lo
// que dice. Los números con modelos de verdad, en el ADR 0048 (cli.ts).
describe("la eval de embeddings del conocimiento", () => {
  it("el set: 24 fragmentos con id único y 40 preguntas, cada una con fragmentos que existen", () => {
    const ids = EMBEDDING_EVAL_CHUNKS.map((chunk) => chunk.id);
    expect([ids.length, new Set(ids).size, EMBEDDING_EVAL_QUERIES.length]).toEqual([24, 24, 40]);
    for (const query of EMBEDDING_EVAL_QUERIES) {
      expect(query.gold.length).toBeGreaterThan(0);
      for (const id of query.gold) expect(ids).toContain(id);
    }
    // En español y en inglés.
    expect(EMBEDDING_EVAL_QUERIES.some((query) => /\b(the|I|my|do you)\b/.test(query.q))).toBe(true);
  });

  it("recall@1, recall@3 y MRR por el puesto del primer fragmento bueno; el empate va por el orden del set", () => {
    const chunks = [
      { id: "a", text: "" },
      { id: "b", text: "" },
      { id: "c", text: "" },
      { id: "d", text: "" },
    ];
    const chunkVectors = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
      [0, 0, 1],
    ];
    const queries = [
      { q: "primero", gold: ["a"] },
      { q: "segundo o tercero", gold: ["d", "b"] },
      { q: "empate", gold: ["d"] },
      { q: "cuarto", gold: ["d"] },
    ];
    const queryVectors = [
      [1, 0, 0],
      [0.9, 0.5, 0],
      [0, 0, 1],
      [0, 0.2, -1],
    ];
    const result = scoreRetrieval(chunks, queries, chunkVectors, queryVectors);
    // Puestos: 1; 2 (b, tras a); 2 (c gana el empate a d); 4 (d, tras b, a y c).
    expect(result.recallAt1).toBe(0.25);
    expect(result.recallAt3).toBe(0.75);
    expect(result.mrr).toBeCloseTo((1 + 1 / 2 + 1 / 2 + 1 / 4) / 4, 10);
    expect(result.misses).toEqual([
      { q: "segundo o tercero", top: "a", rank: 2 },
      { q: "empate", top: "c", rank: 2 },
      { q: "cuarto", top: "b", rank: 4 },
    ]);
  });

  it("no puntúa sin un vector por texto ni una pregunta sin fragmento en el set", () => {
    expect(() => scoreRetrieval([{ id: "a", text: "" }], [{ q: "x", gold: ["a"] }], [], [[1]])).toThrow();
    expect(() => scoreRetrieval([{ id: "a", text: "" }], [{ q: "x", gold: ["z"] }], [[1]], [[1]])).toThrow(/ningún fragmento/);
  });

  it("corre de punta a punta con un embedder (aquí, el falso: por palabras en común)", async () => {
    const result = await runEmbeddingEval(createFakeEmbedder(64), EMBEDDING_EVAL_CHUNKS, EMBEDDING_EVAL_QUERIES);
    expect(result.recallAt1).toBeGreaterThan(0);
    expect(result.recallAt3).toBeGreaterThanOrEqual(result.recallAt1);
    expect(result.mrr).toBeLessThanOrEqual(1);
  });
});
