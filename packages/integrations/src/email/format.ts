// Lo que comparten los emails de aviso (aprobaciones y tope mensual): solo
// enlaces a la app, texto en una línea para el asunto y todo escapado en el HTML.

/** Solo un enlace a la app: https, o http a la máquina local para desarrollo. */
export function appUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("El enlace del aviso no es una URL absoluta");
  }
  const local = url.protocol === "http:" && (url.hostname === "127.0.0.1" || url.hostname === "localhost");
  if (url.protocol !== "https:" && !local) throw new Error("El enlace del aviso tiene que ser https");
  return url.toString();
}

/** Sin saltos de línea ni caracteres de control (el asunto es una cabecera) y sin espacios repetidos. */
export function oneLine(value: string): string {
  // eslint-disable-next-line no-control-regex -- quitar caracteres de control es justo el objetivo
  const CONTROL = /[\u0000-\u001F\u007F]+/g;
  return value.replace(CONTROL, " ").replace(/\s+/g, " ").trim();
}

export function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1).trimEnd()}…`;
}

export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** La de `locations.timezone` por defecto en la base de datos. */
const DEFAULT_TIME_ZONE = "Europe/Madrid";

/**
 * Una fecha y hora en la zona del local, con la zona escrita: quien lee el
 * email puede estar en otra. Una zona que no existe cae a la de por defecto.
 */
export function formatLocalDateTime(iso: string, locale: "es" | "en", timeZone: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "numeric",
    year: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    timeZone: validTimeZone(timeZone),
    timeZoneName: "short",
  }).format(new Date(iso));
}

function validTimeZone(value: string): string {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return value;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}
