import { GATEWAY_EMBEDDING } from "@repo/config";
import { MockEmbeddingModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";
import { GatewayEmbeddingError, createGatewayEmbedder } from "./gateway-embedder.js";
import { createGatewayTransport } from "./gateway.js";

// Los embeddings por Vercel AI Gateway con el modelo de prueba oficial del AI
// SDK: sin red ni clave. Se comprueba qué modelo se pide, por lotes, y que solo
// salen vectores de la dimensión del modelo.
const model = { id: "test/embed", dim: 3, inputUsdPerMTok: 0.02 };

function setup(vectorFor: (text: string) => number[] = (text) => [text.length, 1, 0]) {
  const asked: string[] = [];
  const mocks: MockEmbeddingModelV4[] = [];
  const embedder = createGatewayEmbedder({
    apiKey: "no-se-usa",
    model,
    batchSize: 2,
    embeddingModel: (id) => {
      asked.push(id);
      const mock = new MockEmbeddingModelV4({
        modelId: id,
        maxEmbeddingsPerCall: 100,
        doEmbed: ({ values }) => Promise.resolve({ embeddings: values.map((value) => vectorFor(String(value))), warnings: [] }),
      });
      mocks.push(mock);
      return mock;
    },
  });
  return { embedder, asked, mocks };
}

describe("los embeddings por el gateway", () => {
  it("de serie, el modelo elegido por eval (ADR 0048): 1536 dimensiones", () => {
    expect(GATEWAY_EMBEDDING).toEqual({ id: "openai/text-embedding-3-small", dim: 1536, inputUsdPerMTok: 0.02 });
    const embedder = createGatewayEmbedder({ apiKey: "no-se-usa" });
    expect([embedder.model, embedder.dim]).toEqual(["openai/text-embedding-3-small", 1536]);
    // La misma vía que el transporte del gateway: lo gestionado por la plataforma, sin región UE garantizada.
    expect(embedder.route).toEqual({ provider: "vercel-ai-gateway", region: "other", connection: "managed" });
    const transport = createGatewayTransport({ apiKey: "no-se-usa" });
    expect(embedder.route).toEqual({ provider: transport.provider, region: transport.region, connection: transport.connection });
  });

  it("un vector por texto, en orden, pidiendo el modelo de la configuración y por lotes", async () => {
    const { embedder, asked, mocks } = setup();
    expect(await embedder.embed(["a", "bb", "ccc"])).toEqual([
      [1, 1, 0],
      [2, 1, 0],
      [3, 1, 0],
    ]);
    expect(asked).toEqual(["test/embed", "test/embed"]);
    expect(mocks.flatMap((mock) => mock.doEmbedCalls.map((call) => call.values))).toEqual([["a", "bb"], ["ccc"]]);
    expect([embedder.model, embedder.dim]).toEqual(["test/embed", 3]);
  });

  it("sin textos, ninguna llamada", async () => {
    const { embedder, asked } = setup();
    expect(await embedder.embed([])).toEqual([]);
    expect(asked).toEqual([]);
  });

  it("un vector de otra dimensión o con valores no finitos no se acepta", async () => {
    await expect(setup(() => [1, 2]).embedder.embed(["a"])).rejects.toThrow(GatewayEmbeddingError);
    await expect(setup(() => [1, Number.NaN, 0]).embedder.embed(["a"])).rejects.toThrow(GatewayEmbeddingError);
  });
});
