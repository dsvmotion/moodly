import { z } from "zod";

// Configuración del worker, desde variables de entorno (ADR 0027, «Lo que el
// spike obliga a fijar»). Los errores nombran la variable, nunca su valor: la
// URL de la base de datos lleva la contraseña.

export interface WorkerConfig {
  /** Base de datos de sistema de DBOS (esquema dbos), con el rol dbos_worker. */
  systemDatabaseUrl: string;
  /** Único por proceso vivo (regla 1): dos procesos con el mismo ID repiten pasos. */
  executorId: string;
  /** Fija por despliegue (regla 7): la recuperación solo recoge runs de su versión. */
  applicationVersion: string;
  logLevel: "debug" | "info" | "warn" | "error";
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

const schema = z.object({
  WORKER_SYSTEM_DATABASE_URL: systemDatabaseUrl,
  WORKER_EXECUTOR_ID: z
    .string({ error: "falta WORKER_EXECUTOR_ID" })
    .regex(/^[a-z0-9][a-z0-9._-]{0,63}$/, "WORKER_EXECUTOR_ID: minúsculas, dígitos, punto, guion o guion bajo (máx. 64)"),
  WORKER_APP_VERSION: z
    .string({ error: "falta WORKER_APP_VERSION" })
    .regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/, "WORKER_APP_VERSION: letras, dígitos, punto, guion o guion bajo (máx. 64)"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
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
  };
}
