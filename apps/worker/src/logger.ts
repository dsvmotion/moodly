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

// Lista blanca de lo que sale de un error: tipo, mensaje (pino le suma los de
// la cadena de causas), pila y los campos que dicen qué falló sin datos de
// nadie (el code de pg o de la red: 28P01, ECONNREFUSED…). Fuera quedan detail,
// where, hint, internalQuery, position y cualquier otro campo propio: un 23505
// lleva en detail el valor duplicado (un email, por ejemplo). Las causas y los
// errors de un AggregateError, igual y con tope: nunca se registra una cadena
// entera sin límite.
const ERROR_FIELDS = ["code", "errno", "syscall", "severity", "routine", "constraint", "table", "column", "schema", "dataType"] as const;
const MAX_ERROR_CHAIN = 4;

// Los errores de datos (clase 22) y de integridad (clase 23) de Postgres ponen
// el valor ofensivo en el propio mensaje entre comillas («invalid input syntax
// for type uuid: "ana@…"»): en esos, lo entrecomillado se censura en el mensaje
// y en la pila. El nombre de la restricción o la columna sigue en sus campos.
const PG_VALUE_CLASSES = /^2[23][0-9A-Z]{3}$/;
const QUOTED = /"[^"]*"/g;

// pino suma a cada mensaje y pila los de sus causas, y quien envuelve un error
// suele copiar el mensaje de la causa: basta con un error así en la cadena.
// Se recorre todo lo que pino serializa (la cadena de causas y los errors de un
// AggregateError, a cualquier profundidad), con un Set contra ciclos. El
// resultado vale para todo el error: cada parte se censura igual.
function carriesPgValue(err: Error): boolean {
  const seen = new Set<Error>();
  const pending: unknown[] = [err];
  while (pending.length > 0) {
    const current = pending.pop();
    if (!(current instanceof Error) || seen.has(current)) continue;
    seen.add(current);
    const code = (current as unknown as Record<string, unknown>)["code"];
    if (typeof code === "string" && PG_VALUE_CLASSES.test(code)) return true;
    pending.push(current.cause);
    if (current instanceof AggregateError) pending.push(...(current.errors as unknown[]));
  }
  return false;
}

function serializeError(err: Error, level = 0, pgValues = carriesPgValue(err)): Record<string, unknown> {
  const standard = pino.stdSerializers.err(err);
  const fields = err as unknown as Record<string, unknown>;
  const clean = (text: string | undefined) => (pgValues && text ? text.replace(QUOTED, `"${REDACTED}"`) : text);
  const serialized: Record<string, unknown> = { type: standard.type, message: clean(standard.message), stack: clean(standard.stack) };
  for (const key of ERROR_FIELDS) {
    const value = fields[key];
    if (typeof value === "string" || typeof value === "number") serialized[key] = value;
  }
  if (level >= MAX_ERROR_CHAIN) return serialized;
  if (err.cause instanceof Error) serialized["cause"] = serializeError(err.cause, level + 1, pgValues);
  if (err instanceof AggregateError) {
    serialized["errors"] = err.errors.slice(0, 5).map((inner: unknown) => (inner instanceof Error ? serializeError(inner, level + 1, pgValues) : { type: typeof inner }));
  }
  return serialized;
}

// Lo mismo en todos los campos de un evento, a cualquier profundidad.
function redactFields(value: unknown, depth = 0): unknown {
  if (typeof value === "string") return redactConnectionStrings(value);
  // Un error, ya serializado y censurado: sus campos no son enumerables, y sin
  // esto llegaba vacío ({message: "", stack: ""}) a cualquier campo del log. Va
  // antes del tope de profundidad para que tampoco un error muy anidado salga
  // sin censurar.
  if (value instanceof Error) return redactFields(serializeError(value), Math.min(depth, 8));
  if (depth > 8 || value === null || typeof value !== "object") return typeof value === "object" && value !== null ? "[demasiado anidado]" : value;
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
