// Configuración compartida (MANUAL §3.3). La marca está en revisión legal
// (MANUAL §18 #1): el código usa siempre BRAND_NAME, nunca el nombre a mano.
export const BRAND_NAME = "Moodly";

/**
 * Tipos de agente canónicos (MANUAL §5). Fuente única para `apps/web` y el
 * backend (`agent_types`): clave estable en inglés (BD/API), nombre por defecto
 * en español y token de color de marca (ver packages/ui, `--agent-*`).
 *
 * Resuelve la inconsistencia de la auditoría 2026-10-09: el prototipo usaba
 * claves en español (recepcion/atencion/comercial/administracion) y el MANUAL
 * mencionaba customer/sales/operations/admin. Se fija aquí una sola, alineada
 * con los tokens de color confirmados.
 */
export const AGENT_TYPES = [
  { key: "reception", name: "Recepción", color: "agent-reception" },
  { key: "customer", name: "Atención al cliente", color: "agent-customer" },
  { key: "sales", name: "Comercial", color: "agent-sales" },
  { key: "admin", name: "Administración", color: "agent-admin" },
] as const;

export type AgentTypeKey = (typeof AGENT_TYPES)[number]["key"];

/**
 * Modelos por tarea (MANUAL §5.11, ADR 0033). El código de negocio pide una
 * tarea; la tarea se resuelve a una clave lógica de modelo; y la clave, al ID
 * real de cada proveedor en la configuración de cada transporte. Ningún ID de
 * modelo vive en el código de negocio (AGENTS.md).
 */
export const MODEL_TASKS = ["classify", "extract", "converse", "reason", "embed"] as const;
export type ModelTask = (typeof MODEL_TASKS)[number];

/**
 * Claves lógicas: qué tipo de modelo, no cuál. Se eligen por eval al activar
 * cada proveedor. De más barata a más capaz: `fast`, `balanced` (B-01: el
 * escalón intermedio, para un agente al que `fast` no le basta y `smart` le
 * sobra) y `smart`; `embedding`, solo para los embeddings.
 */
export const MODEL_KEYS = ["fast", "balanced", "smart", "embedding"] as const;
export type ModelKey = (typeof MODEL_KEYS)[number];

/**
 * Por defecto de plataforma por tarea (producto, 2026-11-03: «los modelos que
 * pueden hacer el trabajo»): lo potente para razonar y lo rápido para clasificar
 * y extraer. Para conversar, manda antes el modelo de cada agente
 * (DEFAULT_CONVERSE_MODEL_BY_AGENT); este `smart` queda para una conversación
 * sin agente conocido.
 */
export const DEFAULT_MODEL_BY_TASK: Readonly<Record<ModelTask, ModelKey>> = {
  classify: "fast",
  extract: "fast",
  converse: "smart",
  reason: "smart",
  embed: "embedding",
};

/**
 * Con qué clave conversa cada agente (MANUAL §5.11; producto, 2026-11-11).
 *
 * La regla: cada agente conversa con la clave más barata que pasa sus evals con
 * el modelo real (seguridad 100 %, comportamiento 90 % y un caso que falla en
 * sus 3 corridas bloquea; AGENTS.md → Evals). Solo sube a una clave más capaz
 * cuando las evals demuestran que la barata no basta. Lo más barato siempre,
 * sin dejar de dar el servicio bien.
 *
 * Evidencia (eval B-01, 2026-11-11, `main` 4167952, modelo real por el gateway,
 * 47 casos de un turno, 2–3 corridas cada uno):
 * - `customer` con `fast`: seguridad 39/39 y comportamiento 22/24 (92 %); los dos
 *   casos que fallan aciertan 1 de 3 corridas, así que no bloquean. Unas 37 veces
 *   más barato por caso que con `smart`. → `fast`.
 * - `reception` con `fast`: comportamiento 37/42 (88 %, sin contar un fallo
 *   conocido del runtime), por debajo del 90 %: contesta en español a mensajes
 *   en inglés o francés, no ofrece mover una cita y no pregunta la mesa en un
 *   restaurante. → sigue en `smart`.
 * - `sales` y `admin` todavía no existen ni tienen evals: empiezan en la más
 *   barata, como dice la regla, y no se activan sin pasar antes sus evals; si
 *   no las pasan, suben de clave.
 *
 * Una organización que elige su modelo de conversar (`org_model_settings`,
 * BYOK o enterprise) manda sobre esta tabla. Como AGENT_TYPES, es la semilla de
 * los tipos de serie (ADR 0030 §1): fuera de este paquete nadie escribe una
 * clave de agente; el runtime pregunta con converseModelForAgentType().
 */
export const DEFAULT_CONVERSE_MODEL_BY_AGENT: Readonly<Record<AgentTypeKey, ModelKey>> = {
  reception: "smart",
  customer: "fast",
  sales: "fast",
  admin: "fast",
};

/**
 * La clave con la que conversa un tipo de agente, por la clave de su fila en
 * `agent_types` (la del agente del run, nunca la que diga el LLM). Un tipo que
 * no es de serie (de una plantilla o propio, ADR 0030) no tiene: el enrutador
 * usa entonces la de la tarea.
 */
export function converseModelForAgentType(agentTypeKey: string): ModelKey | undefined {
  return Object.hasOwn(DEFAULT_CONVERSE_MODEL_BY_AGENT, agentTypeKey)
    ? DEFAULT_CONVERSE_MODEL_BY_AGENT[agentTypeKey as AgentTypeKey]
    : undefined;
}

/**
 * Enrutado por intención (PL-T3, punto 3): antes de conversar, un clasificador
 * (determinista o con la tarea `classify`) mira el último mensaje del cliente;
 * las intenciones simples van por el camino barato y la conversación abierta,
 * con el modelo del agente. Apagado hasta que las evals con el modelo real
 * demuestren que el camino barato las contesta bien (V4; AGENTS.md → Evals).
 */
export const INTENT_ROUTING_DEFAULT_ENABLED = false;
/** Las intenciones simples, que puede atender el camino barato. */
export const SIMPLE_INTENTS = ["greeting", "opening_hours", "slots"] as const;
export type SimpleIntent = (typeof SIMPLE_INTENTS)[number];
/** La clave del camino barato. */
export const SIMPLE_INTENT_MODEL: ModelKey = "fast";

export interface GatewayModel {
  /** El modelo en Vercel AI Gateway (`proveedor/modelo`). */
  id: string;
  /** Precio en USD por millón de tokens, para estimar antes de llamar (el coste real lo da el gateway). */
  inputUsdPerMTok: number;
  outputUsdPerMTok: number;
  /**
   * Caché de prompt (PL-T3): leer de la caché y escribir en ella, en USD por
   * millón de tokens. Sin ellos, el transporte cobra la entrada entera a precio
   * normal (nunca se queda corto).
   */
  cacheReadUsdPerMTok?: number;
  cacheWriteUsdPerMTok?: number;
}

/**
 * Qué modelo sirve cada clave por Vercel AI Gateway (ADR 0033). Cambiar de
 * modelo es cambiar esta tabla, nunca el código de negocio.
 */
export const GATEWAY_MODELS: Readonly<Partial<Record<ModelKey, GatewayModel>>> = {
  // Caché, del catálogo del gateway (2026-11-12): escribir (5 minutos) cuesta el 125 % de la entrada;
  // leer, el 10 % en Haiku 5.5 y el 5 % en Opus 5.5.
  fast: { id: "anthropic/claude-haiku-5.5", inputUsdPerMTok: 0.1, outputUsdPerMTok: 0.5, cacheReadUsdPerMTok: 0.01, cacheWriteUsdPerMTok: 0.125 },
  // Precios del catálogo de Vercel AI Gateway (2026-11-11), también los de la caché: Sonnet 5.5 lee a 0,1 $/M (el 5 % de la entrada) y escribe a 2,5 $/M (el 125 %).
  balanced: { id: "anthropic/claude-sonnet-5.5", inputUsdPerMTok: 2, outputUsdPerMTok: 10, cacheReadUsdPerMTok: 0.1, cacheWriteUsdPerMTok: 2.5 },
  smart: { id: "anthropic/claude-opus-5.5", inputUsdPerMTok: 4, outputUsdPerMTok: 20, cacheReadUsdPerMTok: 0.2, cacheWriteUsdPerMTok: 5 },
};

export interface GatewayEmbeddingModel {
  /** El modelo en Vercel AI Gateway (`proveedor/modelo`); se guarda con cada fragmento. */
  id: string;
  /** Las dimensiones de sus vectores: las de la columna y las de la consulta. */
  dim: number;
  inputUsdPerMTok: number;
}

/**
 * El modelo de embeddings del conocimiento (ADR 0048, elegido por eval el
 * 2026-11-09): empata con los mejores en la eval de preguntas de clientes en
 * español e inglés, es el más barato, sus 1536 dimensiones admiten un índice
 * HNSW y tiene región UE listada en el gateway (sin garantía: la vía cuenta
 * como fuera de la UE para «Solo UE»). Cambiarlo es reindexar (ADR 0025 §3).
 */
export const GATEWAY_EMBEDDING: GatewayEmbeddingModel = { id: "openai/text-embedding-3-small", dim: 1536, inputUsdPerMTok: 0.02 };

/**
 * USD → EUR para los topes y los costes, que van en euros. Uno a uno a propósito:
 * un dólar vale menos que un euro, así que el coste anotado nunca se queda corto.
 * El cambio real llega con la facturación (B5).
 */
export const USD_TO_EUR = 1;
