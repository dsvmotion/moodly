// Configuración compartida (MANUAL §3.3). La marca está en revisión legal
// (MANUAL §18 #1): el código usa siempre BRAND_NAME, nunca el nombre a mano.
export const BRAND_NAME = "Moodly";

/**
 * Desde dónde salen los emails de aviso de la plataforma (M-02): una dirección
 * del dominio verificado en Resend. El nombre que se ve es BRAND_NAME.
 */
export const NOTIFICATION_EMAIL_FROM = "notificaciones@moodlycrm.com";

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

/** Claves lógicas: qué tipo de modelo, no cuál. Se eligen por eval al activar cada proveedor. */
export const MODEL_KEYS = ["fast", "smart", "embedding"] as const;
export type ModelKey = (typeof MODEL_KEYS)[number];

/**
 * Por defecto de plataforma (producto, 2026-11-03: «los modelos que pueden hacer
 * el trabajo»): lo potente para conversar con el cliente y razonar, porque
 * conversar es usar herramientas; lo rápido, solo para clasificar y extraer.
 */
export const DEFAULT_MODEL_BY_TASK: Readonly<Record<ModelTask, ModelKey>> = {
  classify: "fast",
  extract: "fast",
  converse: "smart",
  reason: "smart",
  embed: "embedding",
};

export interface GatewayModel {
  /** El modelo en Vercel AI Gateway (`proveedor/modelo`). */
  id: string;
  /** Precio en USD por millón de tokens, para estimar antes de llamar (el coste real lo da el gateway). */
  inputUsdPerMTok: number;
  outputUsdPerMTok: number;
}

/**
 * Qué modelo sirve cada clave por Vercel AI Gateway (ADR 0033). Cambiar de
 * modelo es cambiar esta tabla, nunca el código de negocio.
 */
export const GATEWAY_MODELS: Readonly<Partial<Record<ModelKey, GatewayModel>>> = {
  fast: { id: "anthropic/claude-haiku-5.5", inputUsdPerMTok: 0.1, outputUsdPerMTok: 0.5 },
  smart: { id: "anthropic/claude-opus-5.5", inputUsdPerMTok: 4, outputUsdPerMTok: 20 },
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
