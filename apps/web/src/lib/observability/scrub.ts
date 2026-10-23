// Limpieza de datos personales compartida por los logs y Sentry (ADR 0032). Sin
// dependencias: la usan también los errores del navegador, que no pueden cargar
// pino ni node:crypto.

/** Ruta sin query ni fragmento: un token de invitación nunca llega a los logs. */
export function pathOnly(path: string): string {
  const end = path.search(/[?#]/);
  return end === -1 ? path : path.slice(0, end);
}

const EMAIL = /[^\s@<>"'(),;:]+@[^\s@<>"'(),;:]+\.[a-z]{2,}/gi;

/** Texto con los emails censurados (mensajes de error). */
export function redactEmails(text: string): string {
  return text.replace(EMAIL, "[email]");
}
