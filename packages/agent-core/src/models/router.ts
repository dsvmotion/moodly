import { DEFAULT_MODEL_BY_TASK, converseModelForAgentType } from "@repo/config";
import type { ModelKey, ModelTask } from "@repo/config";

// Enrutador de modelos (ADR 0033, que concreta el 0019). El runtime pide por
// tarea; la política de la organización decide qué transporte puede atenderla
// (residencia, proveedores permitidos, modo de conexión) y si cabe en el
// presupuesto, antes de llamar. Ningún código fuera de ./transports habla con
// un proveedor (test estructural).

export type Residency = "any" | "eu";
export type ConnectionMode = "managed" | "byok" | "customer_cloud";
export type Via = "gateway" | "direct";

/** Política de modelos de una organización: la de plataforma hasta que exista org_model_settings (ADR 0034/0035). */
export interface ModelPolicy {
  residency: Residency;
  /** Proveedores permitidos (p. ej. "anthropic", "openai"); vacía = cualquiera de los configurados. */
  allowedProviders: readonly string[];
  /** La clave por tarea: el por defecto de plataforma con lo que elija la organización encima. */
  modelByTask: Readonly<Record<ModelTask, ModelKey>>;
  /**
   * Solo lo que eligió la organización a propósito (org_model_settings.model_by_task;
   * BYOK o enterprise). Manda sobre el modelo de cada agente (resolveModelKey);
   * sin esto no se distinguiría de un por defecto de plataforma.
   */
  modelOverrides: Readonly<Partial<Record<ModelTask, ModelKey>>>;
  connection: ConnectionMode;
  /** Topes en euros: se comprueban antes de llamar. */
  budget: { perRunEur: number; perDayEur: number };
}

/** Por defecto de plataforma (decisión de producto del 2026-10-24): cualquier proveedor con DPA, claves de Moodly. */
export const PLATFORM_MODEL_POLICY: ModelPolicy = {
  residency: "any",
  allowedProviders: [],
  modelByTask: DEFAULT_MODEL_BY_TASK,
  modelOverrides: {},
  connection: "managed",
  budget: { perRunEur: 0.5, perDayEur: 20 },
};

/** Una llamada a una herramienta que propone el modelo. Los args son lo que dice el LLM: pasan por decide() antes de nada. */
export interface ToolCall {
  id: string;
  name: string;
  args: unknown;
}

/** Una herramienta que ve el modelo: una skill activa del agente (MANUAL §5.3). */
export interface ToolSpec {
  name: string;
  description: string;
  /** JSON Schema de la entrada (z.toJSONSchema del esquema de la skill). */
  inputSchema: Record<string, unknown>;
}

export type ModelMessage =
  | {
      role: "system";
      content: string;
      /**
       * Prefijo estable (PL-T3): no cambia de un turno a otro, así que el
       * transporte pone ahí una marca de caché de prompt. Lo que cambia en cada
       * turno (la hora) va en otro mensaje de sistema, después y sin la marca.
       */
      cacheable?: boolean;
    }
  | { role: "user"; content: string }
  | {
      role: "assistant";
      content: string;
      toolCalls?: readonly ToolCall[];
      /**
       * Lo que devolvió el transporte, tal cual (TransportResponse.providerMessages).
       * Si está, el transporte lo reenvía sin tocarlo: el razonamiento de los
       * modelos actuales va ligado a la conversación y reconstruirlo haría que
       * el proveedor rechazara el paso siguiente.
       */
      providerMessages?: readonly unknown[];
    }
  /** El resultado de una herramienta, para la llamada toolCallId. */
  | { role: "tool"; toolCallId: string; toolName: string; content: string };

/** Lo que pide el runtime. La organización y el run los pone él, nunca el LLM. */
export interface ModelCall {
  organizationId: string;
  runId: string;
  task: ModelTask;
  /**
   * La clave del tipo del agente que conversa (agent_types): sale de la fila del
   * agente del run, nunca de lo que dice el LLM. Con ella, conversar usa el
   * modelo de ese tipo de agente.
   */
  agentType?: string;
  messages: readonly ModelMessage[];
  /** Tope de tokens de salida: con él se estima el coste antes de llamar. */
  maxOutputTokens: number;
  /** Las herramientas que puede pedir (las skills activas del agente). */
  tools?: readonly ToolSpec[];
}

/** Lo que gastó ya la organización: lo lleva el runtime (agent_runs y usage_records). */
export interface Spend {
  runEur: number;
  dayEur: number;
}

export interface TransportRequest {
  modelKey: ModelKey;
  messages: readonly ModelMessage[];
  maxOutputTokens: number;
  tools?: readonly ToolSpec[];
}

export interface TransportResponse {
  text: string;
  /** Las herramientas que pide el modelo; si no pide ninguna, text es su respuesta. */
  toolCalls?: readonly ToolCall[];
  /** Los mensajes del modelo tal como los devolvió el proveedor (JSON), para reenviarlos en el paso siguiente. */
  providerMessages?: readonly unknown[];
  model: string;
  /** Toda la entrada, también la que se leyó o se escribió en la caché de prompt. */
  tokensIn: number;
  tokensOut: number;
  /** De tokensIn, los que se leyeron de la caché de prompt (más baratos). */
  cacheReadTokens?: number;
  /** De tokensIn, los que se escribieron en la caché de prompt (algo más caros). */
  cacheWriteTokens?: number;
  costEur: number;
}

/** Una vía hacia un proveedor (Vercel AI Gateway, directo, la nube del cliente). Vive en ./transports. */
export interface ModelTransport {
  provider: string;
  /** Dónde procesa el proveedor esta vía: "eu" solo si lo garantiza (región fijada y DPA). */
  region: "eu" | "other";
  via: Via;
  connection: ConnectionMode;
  /** Claves lógicas que sabe servir. */
  serves: readonly ModelKey[];
  /** Coste máximo estimado de una llamada, para cortar antes de hacerla. */
  estimateEur(request: TransportRequest): number;
  generate(request: TransportRequest): Promise<TransportResponse>;
}

/** Lo que se registra por llamada (ADR 0019): qué respondió, por dónde y cuánto costó. */
export interface RoutedResult extends TransportResponse {
  provider: string;
  region: "eu" | "other";
  via: Via;
  connection: ConnectionMode;
  modelKey: ModelKey;
  latencyMs: number;
  /** true si respondió el respaldo porque falló el principal. */
  fallback: boolean;
}

export class NoEligibleTransportError extends Error {
  override name = "NoEligibleTransportError";
}

/** El presupuesto no da para la llamada: el runtime pasa a suggest o escala a una persona (MANUAL §15). */
export class BudgetExceededError extends Error {
  override name = "BudgetExceededError";
}

export class AllTransportsFailedError extends Error {
  override name = "AllTransportsFailedError";
  constructor(
    message: string,
    readonly causes: readonly unknown[],
  ) {
    super(message);
  }
}

/** Por dónde va una llamada: lo que mira la política, también para los embeddings (ADR 0048). */
export type RouteOrigin = Pick<ModelTransport, "provider" | "region" | "connection">;

/** Si la política deja usar esa vía: mismo modo de conexión, la residencia y los proveedores permitidos. */
export function policyAllows(policy: ModelPolicy, route: RouteOrigin): boolean {
  return (
    // BYOK nunca cae a credenciales de Moodly, ni lo gestionado a las del cliente.
    route.connection === policy.connection &&
    (policy.residency === "any" || route.region === "eu") &&
    (policy.allowedProviders.length === 0 || policy.allowedProviders.includes(route.provider))
  );
}

/** Los transportes que esta política permite para la clave, en el orden en que se probarán. */
export function eligibleTransports(policy: ModelPolicy, modelKey: ModelKey, transports: readonly ModelTransport[]): ModelTransport[] {
  return transports.filter((transport) => transport.serves.includes(modelKey) && policyAllows(policy, transport));
}

/**
 * Qué clave de modelo atiende una tarea (MANUAL §5.11; producto, 2026-11-11):
 * 1. la que eligió la organización a propósito para esa tarea;
 * 2. para conversar, la del tipo de agente (la más barata que pasa sus evals);
 * 3. la de la tarea en la política (por defecto de plataforma), también para
 *    un tipo de agente sin clave propia.
 */
export function resolveModelKey(policy: ModelPolicy, task: ModelTask, agentType?: string): ModelKey {
  const chosen = policy.modelOverrides[task];
  if (chosen !== undefined) return chosen;
  const byAgent = task === "converse" && agentType !== undefined ? converseModelForAgentType(agentType) : undefined;
  return byAgent ?? policy.modelByTask[task];
}

export interface ModelRouter {
  generate(call: ModelCall, policy: ModelPolicy, spend: Spend): Promise<RoutedResult>;
}

/**
 * El enrutador: el primer transporte elegible es el principal; el siguiente,
 * el respaldo (MANUAL §5.11). El respaldo solo se usa si el principal falla, y
 * con las mismas reglas: nunca sale de la región ni cambia de modo de conexión.
 */
export function createModelRouter(transports: readonly ModelTransport[], now: () => number = Date.now): ModelRouter {
  return {
    async generate(call, policy, spend) {
      const modelKey = resolveModelKey(policy, call.task, call.agentType);
      const candidates = eligibleTransports(policy, modelKey, transports).slice(0, 2);
      if (candidates.length === 0) {
        throw new NoEligibleTransportError(
          `ningún transporte sirve «${modelKey}» con residencia ${policy.residency}, conexión ${policy.connection} y los proveedores permitidos`,
        );
      }
      const request: TransportRequest = {
        modelKey,
        messages: call.messages,
        maxOutputTokens: call.maxOutputTokens,
        ...(call.tools ? { tools: call.tools } : {}),
      };
      const causes: unknown[] = [];
      for (const [index, transport] of candidates.entries()) {
        const estimate = transport.estimateEur(request);
        if (spend.runEur + estimate > policy.budget.perRunEur || spend.dayEur + estimate > policy.budget.perDayEur) {
          throw new BudgetExceededError(
            `la llamada (hasta ${estimate.toFixed(4)} €) supera el tope del run o del día de la organización`,
          );
        }
        const startedAt = now();
        try {
          const response = await transport.generate(request);
          return {
            ...response,
            provider: transport.provider,
            region: transport.region,
            via: transport.via,
            connection: transport.connection,
            modelKey,
            latencyMs: now() - startedAt,
            fallback: index > 0,
          };
        } catch (error) {
          causes.push(error);
        }
      }
      throw new AllTransportsFailedError(`fallaron el principal y el respaldo para «${modelKey}»`, causes);
    },
  };
}
