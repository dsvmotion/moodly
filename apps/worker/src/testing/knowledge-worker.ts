// Proceso de prueba para knowledge/ingest.integration.ts: el worker real con el
// consumidor knowledge.ingest y embeddings falsos y deterministas (sin red ni
// clave). Un texto que contenga FALLA-EMBEDDING hace fallar los embeddings,
// como un gateway caído, y uno con LENTO-EMBEDDING tarda 12 s, como uno lento.
//
//   node knowledge-worker.ts <archivo>
//
// Al arrancar escribe «started» en el archivo.
import { appendFileSync } from "node:fs";
import { EmbeddingError, createFakeEmbedder } from "@repo/knowledge";
import type { Embedder } from "@repo/knowledge";
import { loadConfig } from "../config.ts";
import { logHandler } from "../events/log-handler.ts";
import { createIngestHandler } from "../knowledge/ingest.ts";
import { createLogger } from "../logger.ts";
import { createWorker } from "../worker.ts";

const [markerFile] = process.argv.slice(2);
if (!markerFile) throw new Error("uso: knowledge-worker.ts <archivo>");

const fake = createFakeEmbedder(16);
async function misbehave(texts: readonly string[]): Promise<void> {
  if (texts.some((text) => text.includes("FALLA-EMBEDDING"))) throw new EmbeddingError("gateway caído");
  if (texts.some((text) => text.includes("LENTO-EMBEDDING"))) await new Promise((resolve) => setTimeout(resolve, 12_000));
}
// Con el precio del modelo de serie (0,02 $ por millón de tokens), para ver el coste en el libro.
const EUR_PER_TOKEN = 0.02 / 1_000_000;
const embedder: Embedder = {
  model: fake.model,
  dim: fake.dim,
  async embed(texts) {
    await misbehave(texts);
    return fake.embed(texts);
  },
  async embedWithUsage(texts) {
    await misbehave(texts);
    // Como el embedder del gateway cuando falla el segundo lote: el error lleva lo
    // ya pagado del primero (7 tokens), para que la ingesta lo anote igual.
    if (texts.some((text) => text.includes("FALLA-LOTE-2"))) {
      throw Object.assign(new EmbeddingError("el segundo lote falló"), { usage: { tokens: 7, costEur: 7 * EUR_PER_TOKEN } });
    }
    const vectors = await fake.embed(texts);
    const tokens = texts.reduce((sum, text) => sum + (text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).length, 0);
    return { vectors, usage: { tokens, costEur: tokens * EUR_PER_TOKEN } };
  },
};

const config = loadConfig(process.env);
const logger = createLogger(config.logLevel);
const worker = createWorker(config, logger, {
  // El publicador del outbox cada segundo en lugar de cada 5 s: estos tests esperan a la entrega, no prueban el publicador (eso, outbox.integration.ts).
  outboxTesting: { publishSchedule: "* * * * * *" },
  // Por dónde iría de verdad: el gateway, gestionado por la plataforma y sin región UE garantizada.
  eventHandlers: () => [logHandler, createIngestHandler({ embedder, route: { provider: "vercel-ai-gateway", region: "other", connection: "managed" } })],
  onLeaseLost: (err) => {
    logger.fatal({ err }, "se perdió el lock del executor");
    process.exit(1);
  },
});
process.on("SIGTERM", () => {
  void worker.stop().then(() => process.exit(0));
});
await worker.start();
appendFileSync(markerFile, `${JSON.stringify({ step: "started", pid: process.pid })}\n`);
