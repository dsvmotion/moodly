import { GATEWAY_EMBEDDING, USD_TO_EUR } from "@repo/config";
import type { GatewayEmbeddingModel } from "@repo/config";
import { createGateway, embedMany } from "ai";
import type { EmbeddingModel } from "ai";
import type { RouteOrigin } from "../router.js";

// Los embeddings del conocimiento por Vercel AI Gateway (ADR 0048). Cumple la
// interfaz Embedder de @repo/knowledge (model, dim, embed) sin depender de ese
// paquete: los SDK de proveedor solo viven en agent-core (ADR 0033). El modelo
// sale de @repo/config, nunca del código de negocio.

/** Por qué no hay vectores: la respuesta no tiene uno por texto, o no tiene la dimensión del modelo. */
export class GatewayEmbeddingError extends Error {
  override name = "GatewayEmbeddingError";
}

export interface GatewayEmbedderOptions {
  apiKey: string;
  model?: GatewayEmbeddingModel;
  /** Solo para los tests: el modelo de embeddings del SDK (uno falso). */
  embeddingModel?: (id: string) => EmbeddingModel;
  /** Textos por llamada. */
  batchSize?: number;
  timeoutMs?: number;
}

export interface GatewayEmbedder {
  readonly model: string;
  readonly dim: number;
  /** Por dónde va: lo que mira la política de la organización (policyAllows), como en el enrutador. */
  readonly route: RouteOrigin;
  embed(texts: readonly string[]): Promise<number[][]>;
  /** Lo mismo, con los tokens y lo que costó (el libro de consumo, PL-ledger). */
  embedWithUsage(texts: readonly string[]): Promise<{ vectors: number[][]; usage: { tokens: number; costEur: number } }>;
}

/** El coste que da el gateway (USD), si viene; si no, null. */
function gatewayCostUsd(metadata: unknown): number | null {
  const gateway = (metadata as { gateway?: { cost?: unknown } } | undefined)?.gateway;
  const cost = typeof gateway?.cost === "string" || typeof gateway?.cost === "number" ? Number(gateway.cost) : NaN;
  return Number.isFinite(cost) && cost >= 0 ? cost : null;
}

/** Como el transporte del gateway (gateway.ts): con las claves de la plataforma y sin región garantizada. */
const GATEWAY_ROUTE: RouteOrigin = { provider: "vercel-ai-gateway", region: "other", connection: "managed" };

const DEFAULT_BATCH = 64;
const DEFAULT_TIMEOUT_MS = 30_000;

export function createGatewayEmbedder(options: GatewayEmbedderOptions): GatewayEmbedder {
  const model = options.model ?? GATEWAY_EMBEDDING;
  const provider = options.embeddingModel ? null : createGateway({ apiKey: options.apiKey });
  const embeddingModel = options.embeddingModel ?? ((id: string) => (provider as NonNullable<typeof provider>).embeddingModel(id));
  const batchSize = options.batchSize ?? DEFAULT_BATCH;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  async function embedWithUsage(texts: readonly string[]) {
    const vectors: number[][] = [];
    let tokens = 0;
    let costUsd = 0;
    for (let start = 0; start < texts.length; start += batchSize) {
      const values = texts.slice(start, start + batchSize);
      const result = await embedMany({
        model: embeddingModel(model.id),
        values: [...values],
        // Un solo reintento por fallos de red: quien llama ya reintenta el paso entero.
        maxRetries: 1,
        abortSignal: AbortSignal.timeout(timeoutMs),
      });
      // Lo que costó la llamada se cuenta aunque luego no valga: se pagó igual.
      const batchTokens = Number.isFinite(result.usage?.tokens) ? Math.max(0, Math.round(result.usage.tokens)) : 0;
      tokens += batchTokens;
      costUsd += gatewayCostUsd(result.providerMetadata) ?? (batchTokens * model.inputUsdPerMTok) / 1_000_000;
      const { embeddings } = result;
      if (embeddings.length !== values.length) {
        throw new GatewayEmbeddingError(`el gateway devolvió ${embeddings.length} vectores para ${values.length} textos`);
      }
      for (const vector of embeddings) {
        if (vector.length !== model.dim || !vector.every(Number.isFinite)) {
          throw new GatewayEmbeddingError(`un vector no tiene las ${model.dim} dimensiones del modelo o no es finito`);
        }
        vectors.push([...vector]);
      }
    }
    return { vectors, usage: { tokens, costEur: costUsd * USD_TO_EUR } };
  }

  return {
    model: model.id,
    dim: model.dim,
    route: GATEWAY_ROUTE,
    async embed(texts) {
      return (await embedWithUsage(texts)).vectors;
    },
    embedWithUsage,
  };
}
