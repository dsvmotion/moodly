import { createHmac } from "node:crypto";
import pino, { type DestinationStream, type Logger } from "pino";

// Logs estructurados (ADR 0032, MANUAL §12): una línea JSON por evento en la
// salida estándar, que recoge la plataforma de despliegue. Sin datos personales
// en claro: contraseñas, tokens, emails y cabeceras de sesión se censuran, y para
// correlacionar se usa un seudónimo (HMAC con clave de servidor).
// Sin "server-only" para poder probarlo; la instancia de la app está en logger.ts.

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

export function createLogger(destination?: DestinationStream, level = process.env["LOG_LEVEL"] ?? "info"): Logger {
  return pino(
    {
      level,
      base: { service: "web" },
      messageKey: "msg",
      timestamp: pino.stdTimeFunctions.isoTime,
      formatters: { level: (label) => ({ level: label }) },
      redact: { paths: REDACT_PATHS, censor: REDACTED },
    },
    destination,
  );
}

/**
 * Seudónimo estable de un dato personal (email, IP) para correlacionar eventos
 * sin guardarlo: HMAC-SHA256 con una clave de servidor, recortado a 16 hex. Sin
 * clave no hay seudónimo (un hash sin clave de un email se revierte con un
 * diccionario).
 */
export function pseudonym(value: string, key: string | undefined = process.env["LOG_PSEUDONYM_KEY"]): string | undefined {
  if (!key || key.length < 32) return undefined;
  return createHmac("sha256", key).update(value.trim().toLowerCase()).digest("hex").slice(0, 16);
}

export { pathOnly } from "./scrub";
