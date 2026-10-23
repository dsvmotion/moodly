import pino, { type DestinationStream, type Logger } from "pino";

// Logs del worker (ADR 0032): una línea JSON por evento en la salida estándar,
// como la web, con las mismas claves censuradas. Además, ninguna URL de Postgres
// sale con su contraseña, ni en nuestros mensajes ni en los de DBOS.

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

/** Texto sin la contraseña de ninguna URL de Postgres. */
export function redactConnectionStrings(text: string): string {
  return text.replace(PG_URL_CREDENTIALS, `$1:${REDACTED}@`);
}

// Lo mismo en todos los campos de un evento, a cualquier profundidad.
function redactFields(value: unknown, depth = 0): unknown {
  if (typeof value === "string") return redactConnectionStrings(value);
  if (depth > 8 || value === null || typeof value !== "object") return value;
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
        err: (err: unknown) => {
          const serialized = pino.stdSerializers.err(err as Error);
          return {
            ...serialized,
            message: redactConnectionStrings(String(serialized.message ?? "")),
            stack: redactConnectionStrings(String(serialized.stack ?? "")),
          };
        },
      },
    },
    destination,
  );
}
