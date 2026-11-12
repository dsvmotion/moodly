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

  describe("lo que costó (el libro de consumo, PL-ledger)", () => {
    function withUsage(usage: (values: readonly unknown[]) => { tokens: number; cost?: string }) {
      return createGatewayEmbedder({
        apiKey: "no-se-usa",
        model,
        batchSize: 2,
        embeddingModel: (id) =>
          new MockEmbeddingModelV4({
            modelId: id,
            maxEmbeddingsPerCall: 100,
            doEmbed: ({ values }) => {
              const { tokens, cost } = usage(values);
              return Promise.resolve({
                embeddings: values.map(() => [1, 1, 0]),
                usage: { tokens },
                ...(cost === undefined ? {} : { providerMetadata: { gateway: { cost } } }),
                warnings: [],
              });
            },
          }),
      });
    }

    it("suma los tokens de todos los lotes; sin coste del gateway, con el precio de la tabla", async () => {
      const embedder = withUsage((values) => ({ tokens: values.length * 100 }));
      const { vectors, usage } = await embedder.embedWithUsage(["a", "b", "c"]);
      expect(vectors).toHaveLength(3);
      // Dos lotes (2 + 1 textos): 300 tokens a 0,02 $ por millón.
      expect(usage.tokens).toBe(300);
      expect(usage.costEur).toBeCloseTo((300 * 0.02) / 1_000_000, 12);
    });

    it("con el coste que da el gateway, ese, lote a lote", async () => {
      const embedder = withUsage((values) => ({ tokens: values.length * 100, cost: values.length === 2 ? "0.5" : "0.25" }));
      const { usage } = await embedder.embedWithUsage(["a", "b", "c"]);
      expect(usage).toEqual({ tokens: 300, costEur: 0.75 });
    });

    it("si un lote posterior falla, el error lleva lo ya pagado (usage) para anotarlo igual", async () => {
      let call = 0;
      const embedder = createGatewayEmbedder({
        apiKey: "no-se-usa",
        model,
        batchSize: 2,
        embeddingModel: (id) =>
          new MockEmbeddingModelV4({
            modelId: id,
            maxEmbeddingsPerCall: 100,
            doEmbed: ({ values }) => {
              call += 1;
              if (call === 2) return Promise.reject(new Error("gateway caído"));
              return Promise.resolve({ embeddings: values.map(() => [1, 1, 0]), usage: { tokens: 200 }, warnings: [] });
            },
          }),
      });
      const failure = await embedder.embedWithUsage(["a", "b", "c"]).then(
        () => null,
        (error: unknown) => error,
      );
      expect(failure).toBeInstanceOf(Error);
      expect((failure as { usage?: unknown }).usage).toEqual({ tokens: 200, costEur: (200 * 0.02) / 1_000_000 });
    });

    it("si el primer lote falla, no hay nada pagado que anotar", async () => {
      const embedder = createGatewayEmbedder({
        apiKey: "no-se-usa",
        model,
        embeddingModel: (id) => new MockEmbeddingModelV4({ modelId: id, maxEmbeddingsPerCall: 100, doEmbed: () => Promise.reject(new Error("caído")) }),
      });
      const failure = await embedder.embedWithUsage(["a"]).then(
        () => null,
        (error: unknown) => error,
      );
      expect((failure as { usage?: unknown }).usage).toBeUndefined();
    });

    it("embed devuelve los mismos vectores, sin el coste", async () => {
      const embedder = withUsage(() => ({ tokens: 1 }));
      expect(await embedder.embed(["a"])).toEqual([[1, 1, 0]]);
    });
  });
});
