// La eval de embeddings con modelos de verdad, por Vercel AI Gateway (ADR 0048).
// Llama a la red y cuesta (céntimos): no corre en el CI. Desde la raíz:
//
//   AI_GATEWAY_API_KEY=… pnpm --filter @repo/evals eval:embeddings [modelo:dimensiones …]
//
// Sin modelos, el de la configuración (GATEWAY_EMBEDDING). Por ejemplo:
// openai/text-embedding-3-small:1536 cohere/embed-v4.0:1536.
import { createGatewayEmbedder } from "@repo/agent-core";
import { EMBEDDING_EVAL_CHUNKS, EMBEDDING_EVAL_QUERIES } from "./dataset.js";
import { runEmbeddingEval } from "./score.js";

const apiKey = process.env["AI_GATEWAY_API_KEY"];
if (!apiKey) throw new Error("falta AI_GATEWAY_API_KEY");

const models = process.argv.slice(2).map((arg) => {
  const match = /^(.+):(\d+)$/.exec(arg);
  if (!match?.[1] || !match[2]) throw new Error(`modelo no válido: ${arg} (modelo:dimensiones)`);
  return { id: match[1], dim: Number(match[2]), inputUsdPerMTok: 0 };
});
const embedders = models.length > 0 ? models.map((model) => createGatewayEmbedder({ apiKey, model })) : [createGatewayEmbedder({ apiKey })];

for (const embedder of embedders) {
  const started = Date.now();
  try {
    const result = await runEmbeddingEval(embedder, EMBEDDING_EVAL_CHUNKS, EMBEDDING_EVAL_QUERIES);
    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    process.stdout.write(
      `${embedder.model} (${embedder.dim} d): r@1 ${result.recallAt1.toFixed(3)} · r@3 ${result.recallAt3.toFixed(3)} · MRR ${result.mrr.toFixed(3)} · ${seconds} s\n`,
    );
    for (const miss of result.misses) process.stdout.write(`  «${miss.q}»: salió ${miss.top}; el bueno, en el puesto ${miss.rank}\n`);
  } catch (error) {
    process.stdout.write(`${embedder.model}: error (${(error as Error).name}: ${(error as Error).message})\n`);
  }
}
