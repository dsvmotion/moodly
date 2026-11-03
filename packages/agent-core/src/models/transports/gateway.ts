import { GATEWAY_MODELS, USD_TO_EUR } from "@repo/config";
import type { GatewayModel, ModelKey } from "@repo/config";
import { createGateway, generateText, jsonSchema, tool } from "ai";
import type { LanguageModel, ModelMessage as SdkMessage, ToolSet } from "ai";
import type { ModelMessage, ModelTransport, ToolCall, ToolSpec, TransportRequest, TransportResponse } from "../router.js";

// Vercel AI Gateway (ADR 0033 §2), la primera vía de producción, con el Vercel
// AI SDK. Es el único sitio, junto con el transporte falso, que habla con un
// proveedor (test de frontera de SDKs).
//
// - Conexión gestionada (la clave de Moodly) y región «other»: el gateway no
//   garantiza que se procese en la UE, así que una organización con «Solo UE»
//   no lo usa (lo filtra el enrutador).
// - Un paso cada vez: sin `execute` en las herramientas, el modelo propone y el
//   turno (runAgentTurn) decide con el motor de políticas.
// - Lo que devuelve el modelo se reenvía tal cual en el paso siguiente
//   (providerMessages): el razonamiento de los modelos actuales va ligado a la
//   conversación, y rehacerlo haría que el proveedor rechazara la petición.
// - Si el modelo se niega o la respuesta se corta, falla: el turno pasa a una
//   persona en vez de mandarle al cliente media respuesta.
// - El coste real es el que devuelve el gateway; si no viene, se calcula con la
//   tabla de precios de @repo/config.

export class ModelRefusalError extends Error {
  override name = "ModelRefusalError";
}

export class ModelOutputTruncatedError extends Error {
  override name = "ModelOutputTruncatedError";
}

export class ModelResponseError extends Error {
  override name = "ModelResponseError";
}

export interface GatewayTransportOptions {
  /** AI_GATEWAY_API_KEY del entorno del worker. Nunca se escribe en logs. */
  apiKey: string;
  /** Tope de cada llamada, en milisegundos. */
  timeoutMs?: number;
  /** Solo tests: el modelo de cada id (MockLanguageModelV4 de `ai/test`). */
  languageModel?: (modelId: string) => LanguageModel;
  /** Solo tests: otra tabla de modelos. */
  models?: Readonly<Partial<Record<ModelKey, GatewayModel>>>;
}

const DEFAULT_TIMEOUT_MS = 90_000;
/** Para estimar sin tokenizar: pocos caracteres por token, para no quedarse corto. */
const CHARS_PER_TOKEN = 3;

function modelFor(models: Readonly<Partial<Record<ModelKey, GatewayModel>>>, key: ModelKey): GatewayModel {
  const model = models[key];
  if (!model) throw new ModelResponseError(`el gateway no tiene modelo para «${key}»`);
  return model;
}

function usdToEur(usd: number): number {
  return usd * USD_TO_EUR;
}

function priceEur(model: GatewayModel, inputTokens: number, outputTokens: number): number {
  return usdToEur((inputTokens * model.inputUsdPerMTok + outputTokens * model.outputUsdPerMTok) / 1_000_000);
}

/** Nuestros mensajes en el formato del AI SDK. Los resultados de herramientas seguidos van en un solo mensaje. */
export function toSdkMessages(messages: readonly ModelMessage[]): { system: string | undefined; messages: SdkMessage[] } {
  const system: string[] = [];
  const out: SdkMessage[] = [];
  for (const message of messages) {
    switch (message.role) {
      case "system":
        system.push(message.content);
        break;
      case "user":
        out.push({ role: "user", content: message.content });
        break;
      case "assistant":
        if (message.providerMessages && message.providerMessages.length > 0) {
          out.push(...(message.providerMessages as SdkMessage[]));
        } else {
          out.push({
            role: "assistant",
            content: [
              ...(message.content ? [{ type: "text" as const, text: message.content }] : []),
              ...(message.toolCalls ?? []).map((call) => ({
                type: "tool-call" as const,
                toolCallId: call.id,
                toolName: call.name,
                input: call.args,
              })),
            ],
          });
        }
        break;
      case "tool": {
        const part = {
          type: "tool-result" as const,
          toolCallId: message.toolCallId,
          toolName: message.toolName,
          output: { type: "text" as const, value: message.content },
        };
        const last = out.at(-1);
        if (last?.role === "tool") last.content.push(part);
        else out.push({ role: "tool", content: [part] });
        break;
      }
    }
  }
  return { system: system.length > 0 ? system.join("\n\n") : undefined, messages: out };
}

function toSdkTools(specs: readonly ToolSpec[]): ToolSet {
  return Object.fromEntries(
    specs.map((spec) => [spec.name, tool({ description: spec.description, inputSchema: jsonSchema(spec.inputSchema) })]),
  );
}

function gatewayCostUsd(metadata: unknown): number | null {
  const gateway = (metadata as { gateway?: { cost?: unknown } } | undefined)?.gateway;
  const cost = typeof gateway?.cost === "string" || typeof gateway?.cost === "number" ? Number(gateway.cost) : NaN;
  return Number.isFinite(cost) && cost >= 0 ? cost : null;
}

export function createGatewayTransport(options: GatewayTransportOptions): ModelTransport {
  const models = options.models ?? GATEWAY_MODELS;
  const provider = options.languageModel ? null : createGateway({ apiKey: options.apiKey });
  const languageModel = options.languageModel ?? ((id: string) => (provider as NonNullable<typeof provider>)(id));
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return {
    provider: "vercel-ai-gateway",
    region: "other",
    via: "gateway",
    connection: "managed",
    serves: (Object.keys(models) as ModelKey[]).filter((key) => models[key] !== undefined),
    estimateEur(request: TransportRequest): number {
      const model = modelFor(models, request.modelKey);
      const chars = JSON.stringify(request.messages).length + JSON.stringify(request.tools ?? []).length;
      return priceEur(model, Math.ceil(chars / CHARS_PER_TOKEN), request.maxOutputTokens);
    },
    async generate(request: TransportRequest): Promise<TransportResponse> {
      const model = modelFor(models, request.modelKey);
      const { system, messages } = toSdkMessages(request.messages);
      const result = await generateText({
        model: languageModel(model.id),
        ...(system ? { system } : {}),
        messages,
        ...(request.tools && request.tools.length > 0 ? { tools: toSdkTools(request.tools) } : {}),
        maxOutputTokens: request.maxOutputTokens,
        // El enrutador ya tiene respaldo: aquí, un solo reintento por fallos de red.
        maxRetries: 1,
        abortSignal: AbortSignal.timeout(timeoutMs),
      });
      if (result.finishReason === "content-filter") throw new ModelRefusalError("el modelo no quiso responder");
      if (result.finishReason === "length") throw new ModelOutputTruncatedError("la respuesta se cortó por el tope de tokens");
      if (result.finishReason === "error") throw new ModelResponseError("el modelo terminó con un error");

      const tokensIn = result.usage.inputTokens ?? 0;
      const tokensOut = result.usage.outputTokens ?? 0;
      const costUsd = gatewayCostUsd(result.providerMetadata);
      const toolCalls: ToolCall[] = result.toolCalls.map((call) => ({ id: call.toolCallId, name: call.toolName, args: call.input }));
      const assistant = result.responseMessages.filter((message) => message.role === "assistant");
      return {
        text: result.text,
        ...(toolCalls.length > 0 ? { toolCalls } : {}),
        ...(assistant.length > 0 ? { providerMessages: JSON.parse(JSON.stringify(assistant)) as unknown[] } : {}),
        model: result.response.modelId || model.id,
        tokensIn,
        tokensOut,
        costEur: costUsd === null ? priceEur(model, tokensIn, tokensOut) : usdToEur(costUsd),
      };
    },
  };
}
