import { INTENT_ROUTING_DEFAULT_ENABLED } from "@repo/agent-core";
import { parseNangoHost } from "@repo/integrations";
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
  /**
   * La clave de Resend para los emails de aviso (M-02). Opcional: sin ella no
   * se envía ningún aviso (se registra y se sigue). Nunca va a los logs.
   */
  resendApiKey: string | null;
  /** La URL pública de la web (sin barra final): los enlaces de los avisos. Sin ella, no hay avisos. */
  webAppUrl: string | null;
  /**
   * Enrutado por intención (PL-T3): las intenciones simples conversan con el
   * modelo barato. INTENT_ROUTING=on|off (o true/false, 1/0); por defecto, el de @repo/config
   * (apagado hasta que lo midan las evals con el modelo real).
   */
  intentRouting: boolean;
  /** Puerto del endpoint de salud (PL-health). Railway da PORT; en local, 8080 por defecto. */
  healthPort: number;
  /**
   * Nango, la plataforma de conectores (O-02, ADR 0053). Sin la clave secreta o
   * sin la de firma de los webhooks no se monta /webhooks/nango y ninguna
   * integración de plataforma se activa. Nunca van a los logs.
   */
  nango: { secretKey: string; webhookSigningKey: string; host: string } | null;
  /**
   * WhatsApp por la Cloud API de Meta (O-01, ADR 0020): el secreto de la app
   * (firma de los webhooks), el token de verificación del alta y el token de
   * acceso (envíos). Las tres o ninguna: sin ellas no se abre /channels/whatsapp.
   * Nunca van a los logs.
   */
  whatsapp: { appSecret: string; verifyToken: string; accessToken: string } | null;
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

/** Un secreto opcional de una sola palabra de caracteres visibles; vacío cuenta como ausente. El mensaje nunca lleva el valor. */
function visibleSecret(name: string, min: number, max: number) {
  const pattern = new RegExp(`^[\\x21-\\x7e]{${min},${max}}$`);
  return z
    .string()
    .transform((value) => value.trim())
    .refine((value) => value === "" || pattern.test(value), `${name} no parece un secreto: de ${min} a ${max} caracteres visibles, sin espacios`)
    .optional();
}

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
  // Las claves de Resend empiezan por re_. Vacía cuenta como ausente.
  RESEND_API_KEY: z
    .string()
    .transform((value) => value.trim())
    .refine((value) => value === "" || /^re_[A-Za-z0-9_-]{8,200}$/.test(value), "RESEND_API_KEY no parece una clave de Resend (re_…)")
    .optional(),
  // HTTPS fuera de local: el enlace va en un email. Sin ruta, credenciales ni parámetros.
  WEB_APP_URL: z
    .string()
    .transform((value) => value.trim().replace(/\/+$/, ""))
    .refine((value) => {
      if (value === "") return true;
      if (!URL.canParse(value)) return false;
      const url = new URL(value);
      if (url.username || url.password || url.search || url.hash || url.pathname !== "/") return false;
      return url.protocol === "https:" || (url.protocol === "http:" && LOCAL_HOSTS.has(url.hostname));
    }, "WEB_APP_URL: https://dominio (o http:// solo en local), sin ruta, credenciales ni parámetros")
    .optional(),
  // Nango (O-02). Vacías cuentan como ausentes. La URL base: https, o http solo en loopback.
  NANGO_API_KEY: z
    .string()
    .transform((value) => value.trim())
    .refine((value) => value === "" || /^[\x21-\x7e]{16,512}$/.test(value), "NANGO_API_KEY no parece una clave: de 16 a 512 caracteres visibles, sin espacios")
    .optional(),
  NANGO_WEBHOOK_SIGNING_KEY: z
    .string()
    .transform((value) => value.trim())
    .refine((value) => value === "" || /^[\x21-\x7e]{16,512}$/.test(value), "NANGO_WEBHOOK_SIGNING_KEY no parece una clave: de 16 a 512 caracteres visibles, sin espacios")
    .optional(),
  NANGO_HOST: z
    .string()
    .refine((value) => {
      try {
        parseNangoHost(value);
        return true;
      } catch {
        return false;
      }
    }, "NANGO_HOST: https://… (o http:// solo en loopback), sin credenciales ni parámetros")
    .optional(),
  // WhatsApp Cloud API (O-01). Vacías cuentan como ausentes; las tres o ninguna.
  WHATSAPP_APP_SECRET: visibleSecret("WHATSAPP_APP_SECRET", 16, 512),
  WHATSAPP_VERIFY_TOKEN: visibleSecret("WHATSAPP_VERIFY_TOKEN", 16, 512),
  WHATSAPP_ACCESS_TOKEN: visibleSecret("WHATSAPP_ACCESS_TOKEN", 16, 2048),
  // on/off, true/false o 1/0 (sin distinguir mayúsculas); otra cosa para el arranque con un mensaje claro.
  INTENT_ROUTING: z
    .string()
    .transform((value) => value.trim().toLowerCase())
    .refine((value) => ["on", "off", "true", "false", "1", "0", ""].includes(value), "INTENT_ROUTING: on/off, true/false o 1/0")
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
    resendApiKey: parsed.data.RESEND_API_KEY || null,
    webAppUrl: parsed.data.WEB_APP_URL || null,
    // Vacía cuenta como ausente (así se quita en Railway sin borrar la variable).
    intentRouting: !parsed.data.INTENT_ROUTING ? INTENT_ROUTING_DEFAULT_ENABLED : ["on", "true", "1"].includes(parsed.data.INTENT_ROUTING),
    healthPort: Number(parsed.data.PORT ?? "8080"),
    nango:
      parsed.data.NANGO_API_KEY && parsed.data.NANGO_WEBHOOK_SIGNING_KEY
        ? {
            secretKey: parsed.data.NANGO_API_KEY,
            webhookSigningKey: parsed.data.NANGO_WEBHOOK_SIGNING_KEY,
            host: parseNangoHost(parsed.data.NANGO_HOST),
          }
        : null,
    whatsapp: whatsappConfig(parsed.data),
  };
}

function whatsappConfig(data: { WHATSAPP_APP_SECRET?: string | undefined; WHATSAPP_VERIFY_TOKEN?: string | undefined; WHATSAPP_ACCESS_TOKEN?: string | undefined }): WorkerConfig["whatsapp"] {
  const values = { appSecret: data.WHATSAPP_APP_SECRET || "", verifyToken: data.WHATSAPP_VERIFY_TOKEN || "", accessToken: data.WHATSAPP_ACCESS_TOKEN || "" };
  const present = Object.values(values).filter(Boolean).length;
  if (present === 0) return null;
  // A medias es un error de configuración, no «sin WhatsApp»: se dice al arrancar.
  if (present < 3) throw new WorkerConfigError("Configuración del worker no válida: WhatsApp necesita WHATSAPP_APP_SECRET, WHATSAPP_VERIFY_TOKEN y WHATSAPP_ACCESS_TOKEN, las tres o ninguna");
  return values;
}
