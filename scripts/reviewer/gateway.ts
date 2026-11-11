// Llamada al modelo por Vercel AI Gateway (API compatible con Chat Completions),
// sin dependencias: la Revisora corre desde la rama base sin instalar nada.

import { CHARS_PER_TOKEN, MAX_OUTPUT_TOKENS, MAX_REVIEW_EUR, type LevelModel } from "./config.ts";
import type { ChatMessage } from "./prompt.ts";

export const GATEWAY_URL = "https://ai-gateway.vercel.sh/v1/chat/completions";

export interface Usage {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
}

/** El coste máximo antes de llamar: la entrada estimada por lo alto y el tope de salida entero. */
export function worstCaseEur(messages: readonly ChatMessage[], model: LevelModel): number {
  const chars = messages.reduce((sum, message) => sum + message.content.length, 0);
  const inputTokens = Math.ceil(chars / CHARS_PER_TOKEN);
  return (inputTokens * model.inputEurPerMTok + MAX_OUTPUT_TOKENS * model.outputEurPerMTok) / 1_000_000;
}

/** El coste con los tokens reales. Estimación con los precios de `packages/config`: el real lo da el gateway. */
export function costEur(usage: Usage, model: LevelModel): number {
  return (usage.inputTokens * model.inputEurPerMTok + usage.outputTokens * model.outputEurPerMTok) / 1_000_000;
}

export function withinBudget(messages: readonly ChatMessage[], model: LevelModel): boolean {
  return worstCaseEur(messages, model) <= MAX_REVIEW_EUR;
}

export interface Completion {
  text: string;
  usage: Usage;
  finishReason: string | null;
}

export async function complete(input: {
  apiKey: string;
  model: LevelModel;
  messages: readonly ChatMessage[];
  fetchImpl?: typeof fetch;
}): Promise<Completion> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const response = await fetchImpl(GATEWAY_URL, {
    method: "POST",
    headers: { authorization: `Bearer ${input.apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: input.model.id,
      messages: input.messages,
      max_tokens: MAX_OUTPUT_TOKENS,
      stream: false,
      providerOptions: { gateway: { caching: "auto" } },
    }),
    signal: AbortSignal.timeout(180_000),
  });
  if (!response.ok) {
    // Sin el cuerpo: podría reflejar parte de la petición.
    throw new Error(`El gateway respondió ${response.status}`);
  }
  const body = (await response.json()) as {
    choices?: { message?: { content?: string | null }; finish_reason?: string | null }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number; prompt_tokens_details?: { cached_tokens?: number } };
  };
  const choice = body.choices?.[0];
  return {
    text: choice?.message?.content ?? "",
    finishReason: choice?.finish_reason ?? null,
    usage: {
      inputTokens: body.usage?.prompt_tokens ?? 0,
      cachedInputTokens: body.usage?.prompt_tokens_details?.cached_tokens ?? 0,
      outputTokens: body.usage?.completion_tokens ?? 0,
    },
  };
}
