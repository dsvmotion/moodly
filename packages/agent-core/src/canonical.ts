import { createHash } from "node:crypto";

// JSON canónico para el hash de una ejecución (ADR 0047 §3): claves ordenadas,
// sin espacios y UTF-8, al estilo de RFC 8785. Dos entradas con el mismo
// contenido dan el mismo texto aunque sus claves lleguen en otro orden; si
// cambia un solo valor, cambia el hash.
//
// Solo admite lo que cabe en JSON sin ambigüedad. Rechaza (en vez de convertir
// en silencio) undefined, funciones, bigint, números no finitos y objetos que
// no sean planos (Date, Map…), porque JSON.stringify los perdería o los
// cambiaría y dos entradas distintas podrían dar el mismo hash.

export class CanonicalJsonError extends Error {
  override name = "CanonicalJsonError";
}

export function canonicalJson(value: unknown): string {
  return serialize(value, "$");
}

function serialize(value: unknown, path: string): string {
  if (value === null) return "null";
  switch (typeof value) {
    case "string":
    case "boolean":
      return JSON.stringify(value);
    case "number":
      if (!Number.isFinite(value)) throw new CanonicalJsonError(`${path}: número no finito`);
      // Object.is(-0, 0) es false, pero JSON no distingue -0 de 0.
      return JSON.stringify(Object.is(value, -0) ? 0 : value);
    case "object":
      break;
    default:
      throw new CanonicalJsonError(`${path}: ${typeof value} no cabe en JSON`);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item, index) => serialize(item, `${path}[${index}]`)).join(",")}]`;
  }
  const proto: unknown = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) {
    throw new CanonicalJsonError(`${path}: solo objetos planos`);
  }
  const record = value as Record<string, unknown>;
  // Orden por unidades UTF-16, como RFC 8785 (el sort por defecto de JS).
  const keys = Object.keys(record).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${serialize(record[key], `${path}.${key}`)}`).join(",")}}`;
}

/** SHA-256 en hexadecimal del JSON canónico. */
export function canonicalHash(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
}
