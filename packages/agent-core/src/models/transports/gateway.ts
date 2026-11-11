import { GATEWAY_MODELS, USD_TO_EUR } from "@repo/config";
import type { GatewayModel, ModelKey } from "@repo/config";
import { createGateway, generateText, jsonSchema, tool } from "ai";
import type { LanguageModel, ModelMessage as SdkMessage, SystemModelMessage, ToolSet } from "ai";
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
//   tabla de precios de @repo/config, con la caché de prompt aparte.
// - Caché de prompt (PL-T3): marcas explícitas de Anthropic (cacheControl),
//   solo donde lo escrito se va a leer después (escribir cuesta un 25 % más):
//   - el último mensaje de sistema estable: herramientas y reglas, iguales en
//     cada paso y en cada turno de la misma configuración. La hora y la
//     historia van después y no entran;
//   - sin sistema estable, la última herramienta (las herramientas van primero);
//   - el último mensaje, solo si el turno ya sigue tras una herramienta: el
//     paso siguiente leerá ese prefijo. En el primer paso no se marca, porque
//     en un turno de un solo paso nadie lo leería.
//   Anthropic admite hasta 4 marcas; otros proveedores ignoran las opciones de
//   `anthropic`. A mano y no con `caching: "auto"` del gateway porque solo
//   aquí se sabe qué parte del sistema es estable.

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

/** Lo que se cobra de una llamada: la entrada partida según la caché de prompt. */
export interface BilledTokens {
  /** Entrada sin caché, a precio normal. */
  input: number;
  cacheRead: number;
  cacheWrite: number;
  output: number;
}

export function priceEur(model: GatewayModel, tokens: BilledTokens): number {
  const usd =
    tokens.input * model.inputUsdPerMTok +
    tokens.cacheRead * (model.cacheReadUsdPerMTok ?? model.inputUsdPerMTok) +
    tokens.cacheWrite * (model.cacheWriteUsdPerMTok ?? model.inputUsdPerMTok) +
    tokens.output * model.outputUsdPerMTok;
  return usdToEur(usd / 1_000_000);
}

/** La marca de caché de prompt de Anthropic: hasta aquí, el prefijo se guarda y se reutiliza. */
export const CACHE_BREAKPOINT = { anthropic: { cacheControl: { type: "ephemeral" } } } as const;

/**
 * Nuestros mensajes en el formato del AI SDK, con las marcas de caché de prompt
 * del sistema estable y del último mensaje (ver arriba). Los resultados de
 * herramientas seguidos van en un solo mensaje.
 */
export function toSdkMessages(messages: readonly ModelMessage[]): { system: SystemModelMessage[]; messages: SdkMessage[] } {
  const system: SystemModelMessage[] = [];
  let stableSystem = -1;
  const out: SdkMessage[] = [];
  for (const message of messages) {
    switch (message.role) {
      case "system":
        if (message.cacheable) stableSystem = system.length;
        system.push({ role: "system", content: message.content });
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
  const stable = system[stableSystem];
  if (stable) system[stableSystem] = { ...stable, providerOptions: CACHE_BREAKPOINT };
  // Solo si el turno ya va por un paso con herramientas: el siguiente leerá este prefijo.
  // Lo que devolvió el proveedor no se toca; el último mensaje de un paso así es un resultado.
  const last = out.at(-1);
  if (last?.role === "tool") out[out.length - 1] = { ...last, providerOptions: CACHE_BREAKPOINT };
  return { system, messages: out };
}

/**
 * Las herramientas. Con `mark`, la marca de caché en la última (así se guardan
 * todas); solo hace falta si no hay sistema estable, cuya marca ya las cubre.
 */
export function toSdkTools(specs: readonly ToolSpec[], mark = true): ToolSet {
  return Object.fromEntries(
    specs.map((spec, index) => [
      spec.name,
      tool({
        description: spec.description,
        inputSchema: jsonSchema(spec.inputSchema),
        ...(mark && index === specs.length - 1 ? { providerOptions: CACHE_BREAKPOINT } : {}),
      }),
    ]),
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
      const input = Math.ceil(chars / CHARS_PER_TOKEN);
      // Por lo alto: si escribir en la caché cuesta más que la entrada normal, toda la entrada a ese precio.
      const writeCostsMore = (model.cacheWriteUsdPerMTok ?? 0) > model.inputUsdPerMTok;
      return priceEur(model, { input: writeCostsMore ? 0 : input, cacheRead: 0, cacheWrite: writeCostsMore ? input : 0, output: request.maxOutputTokens });
    },
    async generate(request: TransportRequest): Promise<TransportResponse> {
      const model = modelFor(models, request.modelKey);
      const { system, messages } = toSdkMessages(request.messages);
      const result = await generateText({
        model: languageModel(model.id),
        ...(system.length > 0 ? { system } : {}),
        messages,
        ...(request.tools && request.tools.length > 0 ? { tools: toSdkTools(request.tools, !request.messages.some((message) => message.role === "system" && message.cacheable)) } : {}),
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
      const cacheReadTokens = result.usage.inputTokenDetails.cacheReadTokens ?? 0;
      const cacheWriteTokens = result.usage.inputTokenDetails.cacheWriteTokens ?? 0;
      const billed: BilledTokens = {
        input: result.usage.inputTokenDetails.noCacheTokens ?? Math.max(0, tokensIn - cacheReadTokens - cacheWriteTokens),
        cacheRead: cacheReadTokens,
        cacheWrite: cacheWriteTokens,
        output: tokensOut,
      };
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
        ...(cacheReadTokens > 0 ? { cacheReadTokens } : {}),
        ...(cacheWriteTokens > 0 ? { cacheWriteTokens } : {}),
        costEur: costUsd === null ? priceEur(model, billed) : usdToEur(costUsd),
      };
    },
  };
}
