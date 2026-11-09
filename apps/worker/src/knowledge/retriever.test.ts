import type { TenantDb } from "@repo/db/service";
import { createFakeEmbedder } from "@repo/knowledge";
import { describe, expect, it } from "vitest";
import { KnowledgeScopeError, createKnowledgeRetriever } from "./retriever.ts";

// El retriever del worker busca con la organización de su acceso (tenantDb), y
// solo con esa: si el alcance de la búsqueda dice otra, falla sin buscar.
const ORG = "a0000000-0000-4000-8000-000000000000";
const OTHER = "b0000000-0000-4000-8000-000000000000";
const LOC = "a2000000-0000-4000-8000-000000000001";

function fakeDb() {
  const calls: unknown[] = [];
  const db = {
    organizationId: ORG,
    searchKnowledge(params: unknown) {
      calls.push(params);
      return Promise.resolve([
        { chunk_id: "c1", source_id: "s1", source_type: "pricing", source_title: "Precios", content: "El láser cuesta 39 euros.", score: 0.03 },
      ]);
    },
  } as unknown as TenantDb;
  return { db, calls };
}

describe("el conocimiento en el worker", () => {
  it("busca con la organización de su acceso y el local del alcance", async () => {
    const { db, calls } = fakeDb();
    const embedder = createFakeEmbedder(16);
    const hits = await createKnowledgeRetriever(db, embedder).search({ scope: { organizationId: ORG, locationId: LOC }, query: "precio del láser", k: 5 });
    expect(hits).toEqual([
      {
        untrusted: true,
        source: "knowledge:s1",
        chunkId: "c1",
        content: "El láser cuesta 39 euros.",
        score: 0.03,
        citation: { sourceId: "s1", type: "pricing", title: "Precios" },
      },
    ]);
    expect(calls).toMatchObject([{ locationId: LOC, embeddingModel: "fake-hash-16", query: "precio del láser", k: 5 }]);
  });

  it("otra organización en el alcance: falla sin buscar", async () => {
    const { db, calls } = fakeDb();
    await expect(
      createKnowledgeRetriever(db, createFakeEmbedder(16)).search({ scope: { organizationId: OTHER, locationId: null }, query: "precio", k: 5 }),
    ).rejects.toThrow(KnowledgeScopeError);
    expect(calls).toEqual([]);
  });
});
