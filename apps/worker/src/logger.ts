import pino, { type DestinationStream, type Logger } from "pino";

// Logs del worker (ADR 0032): una línea JSON por evento en la salida estándar,
// como la web, con las mismas claves censuradas. Además, ninguna URL de Postgres
// sale con su contraseña ni ninguna clave secreta de Supabase, ni en nuestros
// mensajes ni en los de DBOS.

const REDACT_PATHS = [
  "password",
  "token",
  "email",
  "access_token",
  "refresh_token",
  "*.password",
  "*.token",
  "*.email",
  "*.access_token",
  "*.refresh_token",
  "headers.cookie",
  "headers.authorization",
  "*.headers.cookie",
  "*.headers.authorization",
];

export const REDACTED = "[redactado]";

// usuario:contraseña@ de cualquier URL postgres:// o postgresql://.
const PG_URL_CREDENTIALS = /(postgres(?:ql)?:\/\/[^:@\s/]+):[^@\s]+@/gi;
// La clave secreta de Supabase (createServiceDb), por si apareciera en un error.
const SUPABASE_SECRET_KEY = /sb_secret_[A-Za-z0-9_-]+/g;

/** Texto sin la contraseña de ninguna URL de Postgres ni claves secretas de Supabase. */
export function redactConnectionStrings(text: string): string {
  return text.replace(PG_URL_CREDENTIALS, `$1:${REDACTED}@`).replace(SUPABASE_SECRET_KEY, `sb_secret_${REDACTED}`);
}

// El serializador de pino junta los mensajes de la cadena de causas pero pierde
// sus campos (el code de pg o de la red: 28P01, ECONNREFUSED…): la causa va
// además entera, serializada igual.
function serializeError(err: Error): Record<string, unknown> {
  const serialized: Record<string, unknown> = { ...pino.stdSerializers.err(err) };
  if (err.cause instanceof Error) serialized["cause"] = serializeError(err.cause);
  return serialized;
}

// Lo mismo en todos los campos de un evento, a cualquier profundidad.
function redactFields(value: unknown, depth = 0): unknown {
  if (typeof value === "string") return redactConnectionStrings(value);
  if (depth > 8 || value === null || typeof value !== "object") return value;
  // Un error, ya serializado (tipo, mensaje, pila, code, cause y los errors de un
  // AggregateError) y censurado: sus campos no son enumerables, y sin esto el
  // error llegaba vacío ({message: "", stack: ""}) a cualquier campo del log.
  if (value instanceof Error) return redactFields(serializeError(value), depth + 1);
  if (Array.isArray(value)) return value.map((item) => redactFields(item, depth + 1));
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, redactFields(item, depth + 1)]));
}

export function createLogger(level: string, destination?: DestinationStream): Logger {
  return pino(
    {
      level,
      base: { service: "worker" },
      messageKey: "msg",
      timestamp: pino.stdTimeFunctions.isoTime,
      formatters: {
        level: (label) => ({ level: label }),
        log: (object) => redactFields(object) as Record<string, unknown>,
      },
      redact: { paths: REDACT_PATHS, censor: REDACTED },
      hooks: {
        // Cada argumento de texto (mensaje o interpolación) pasa por la censura
        // de URLs de Postgres.
        logMethod(args, method) {
          method.apply(
            this,
            args.map((arg) => (typeof arg === "string" ? redactConnectionStrings(arg) : arg)) as Parameters<typeof method>,
          );
        },
      },
      serializers: {
        // Llega ya serializado por redactFields; lo que no es un error (un texto
        // o un objeto lanzado) se registra como texto, censurado.
        err: (err: unknown) => {
          if (err instanceof Error) return redactFields(serializeError(err));
          if (err !== null && typeof err === "object") return err;
          return { type: typeof err, message: redactConnectionStrings(String(err)) };
        },
      },
    },
    destination,
  );
}
