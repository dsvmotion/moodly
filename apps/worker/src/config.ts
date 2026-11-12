import { z } from "zod";

// Configuración del worker, desde variables de entorno (ADR 0027, «Lo que el
// spike obliga a fijar»). Los errores nombran la variable, nunca su valor: la
// URL de la base de datos lleva la contraseña y SUPABASE_SECRET_KEY es secreta.

export interface WorkerConfig {
  /** Base de datos de sistema de DBOS (esquema dbos), con el rol dbos_worker. */
  systemDatabaseUrl: string;
  /** Único por proceso vivo (regla 1): dos procesos con el mismo ID repiten pasos. */
  executorId: string;
  /** Fija por despliegue (regla 7): la recuperación solo recoge runs de su versión. */
  applicationVersion: string;
  logLevel: "debug" | "info" | "warn" | "error";
  /** Commit desplegado, solo para los logs (Railway lo da en RAILWAY_GIT_COMMIT_SHA). */
  gitCommit: string | null;
  /** API de Supabase y su clave secreta: los datos de las organizaciones (createServiceDb, ADR 0009). */
  supabaseUrl: string;
  supabaseSecretKey: string;
  /**
   * Los datos de las organizaciones por SQL bajo RLS, con el rol moodly_worker
   * (ADR 0049, PL-T1): forOrganization(org).transaction. @repo/db comprueba al
   * conectar que la conexión es de verdad moodly_worker y no se salta RLS.
   */
  workerDatabaseUrl: string;
  /**
   * La clave de Vercel AI Gateway (ADR 0033 §7). Opcional: sin ella no hay
   * modelo, y cada conversación pasa a una persona en vez de quedarse sin
   * respuesta (MANUAL §15.1). Nunca va a los logs.
   */
  aiGatewayApiKey: string | null;
  /** Puerto del endpoint de salud (PL-health). Railway da PORT; en local, 8080 por defecto. */
  healthPort: number;
}

// El pooler de Supabase en modo transacción escucha en el 6543 y no admite
// LISTEN/NOTIFY, que DBOS usa para despertar las esperas (regla 8).
const TRANSACTION_POOLER_PORT = "6543";

const systemDatabaseUrl = z
  .string({ error: "falta WORKER_SYSTEM_DATABASE_URL" })
  .refine((value) => {
    try {
      const url = new URL(value);
      return url.protocol === "postgres:" || url.protocol === "postgresql:";
    } catch {
      return false;
    }
  }, "WORKER_SYSTEM_DATABASE_URL no es una URL de Postgres")
  .refine(
    (value) => URL.canParse(value) && new URL(value).port !== TRANSACTION_POOLER_PORT,
    "WORKER_SYSTEM_DATABASE_URL apunta al pooler en modo transacción (6543): DBOS necesita una conexión de sesión o directa",
  );

// moodly_worker: directo («moodly_worker») o por el pooler de Supabase
// («moodly_worker.<ref>»). Cualquier otro usuario (postgres, service_role) se
// saltaría RLS; @repo/db lo vuelve a comprobar en cada conexión.
const workerDatabaseUrl = z
  .string({ error: "falta WORKER_DATABASE_URL" })
  .refine((value) => {
    if (!URL.canParse(value)) return false;
    const url = new URL(value);
    return (url.protocol === "postgres:" || url.protocol === "postgresql:") && /^moodly_worker(\.[a-z0-9]+)?$/.test(decodeURIComponent(url.username));
  }, "WORKER_DATABASE_URL: una URL de Postgres con el usuario moodly_worker (o moodly_worker.<ref> por el pooler)");

// HTTPS fuera de local: la clave secreta viaja en cada petición.
const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);
const supabaseUrl = z
  .string({ error: "falta SUPABASE_URL" })
  .refine((value) => {
    if (!URL.canParse(value)) return false;
    const url = new URL(value);
    if (url.username || url.password || url.search || url.hash) return false;
    return url.protocol === "https:" || (url.protocol === "http:" && LOCAL_HOSTS.has(url.hostname));
  }, "SUPABASE_URL: https://… (o http:// solo en local), sin credenciales ni parámetros");

const schema = z.object({
  WORKER_SYSTEM_DATABASE_URL: systemDatabaseUrl,
  WORKER_EXECUTOR_ID: z
    .string({ error: "falta WORKER_EXECUTOR_ID" })
    .regex(/^[a-z0-9][a-z0-9._-]{0,63}$/, "WORKER_EXECUTOR_ID: minúsculas, dígitos, punto, guion o guion bajo (máx. 64)"),
  WORKER_APP_VERSION: z
    .string({ error: "falta WORKER_APP_VERSION" })
    .regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/, "WORKER_APP_VERSION: letras, dígitos, punto, guion o guion bajo (máx. 64)"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  RAILWAY_GIT_COMMIT_SHA: z
    .string()
    .regex(/^[0-9a-f]{7,40}$/, "RAILWAY_GIT_COMMIT_SHA no es un commit")
    .optional(),
  SUPABASE_URL: supabaseUrl,
  WORKER_DATABASE_URL: workerDatabaseUrl,
  SUPABASE_SECRET_KEY: z
    .string({ error: "falta SUPABASE_SECRET_KEY" })
    .regex(/^sb_secret_[A-Za-z0-9_-]{16,200}$/, "SUPABASE_SECRET_KEY no es una clave secreta de Supabase (sb_secret_…)"),
  // Sin formato propio documentado: una sola palabra de caracteres visibles.
  // Vacía cuenta como ausente (así se quita en Railway sin borrar la variable).
  PORT: z
    .string()
    .regex(/^\d{1,5}$/, "PORT: un número de puerto")
    .refine((value) => Number(value) >= 1 && Number(value) <= 65535, "PORT: de 1 a 65535")
    .optional(),
  AI_GATEWAY_API_KEY: z
    .string()
    .transform((value) => value.trim())
    .refine((value) => value === "" || /^[\x21-\x7e]{16,512}$/.test(value), "AI_GATEWAY_API_KEY no parece una clave: de 16 a 512 caracteres visibles, sin espacios")
    .optional(),
});

export class WorkerConfigError extends Error {
  override name = "WorkerConfigError";
}

export function loadConfig(env: Record<string, string | undefined>): WorkerConfig {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    // Solo los mensajes, que son nuestros: ni el valor recibido ni la entrada.
    throw new WorkerConfigError(`Configuración del worker no válida: ${parsed.error.issues.map((i) => i.message).join("; ")}`);
  }
  return {
    systemDatabaseUrl: parsed.data.WORKER_SYSTEM_DATABASE_URL,
    executorId: parsed.data.WORKER_EXECUTOR_ID,
    applicationVersion: parsed.data.WORKER_APP_VERSION,
    logLevel: parsed.data.LOG_LEVEL,
    gitCommit: parsed.data.RAILWAY_GIT_COMMIT_SHA ?? null,
    supabaseUrl: parsed.data.SUPABASE_URL.replace(/\/+$/, ""),
    supabaseSecretKey: parsed.data.SUPABASE_SECRET_KEY,
    workerDatabaseUrl: parsed.data.WORKER_DATABASE_URL,
    aiGatewayApiKey: parsed.data.AI_GATEWAY_API_KEY || null,
    healthPort: Number(parsed.data.PORT ?? "8080"),
  };
}
