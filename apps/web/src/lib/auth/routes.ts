// Política de rutas de la app, pura para poder probarla sin Next ni Supabase.
// La barrera real de datos es RLS (MANUAL §10.2); esto solo decide a dónde
// se envía a cada visitante.

export const LOGIN_PATH = "/login";
export const HOME_PATH = "/app";
/** Paso del segundo factor tras la contraseña (exige sesión: no es pública). */
export const MFA_PATH = "/login/mfa";

/** Rutas accesibles sin sesión. Todo lo demás exige usuario autenticado. */
const PUBLIC_PATHS = new Set([LOGIN_PATH]);

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.has(pathname);
}

const INTERNAL_ORIGIN = "http://app.internal";
// Caracteres de control, espacios y barras invertidas: el navegador elimina
// tabuladores y saltos de línea de las URL y trata "\" como "/", así que
// "/\t/evil.test" o "/\evil.test" acabarían siendo "//evil.test" (externo).
// eslint-disable-next-line no-control-regex -- buscar caracteres de control es justo el objetivo
const UNSAFE_CHARS = /[\u0000-\u001F\u007F\s\\]/;

/**
 * Destino tras el login, solo si es una ruta interna de la app. Evita
 * redirecciones abiertas: se resuelve contra un origen interno ficticio y se
 * exige que el origen no cambie.
 */
export function safeNextPath(next: unknown): string {
  if (typeof next !== "string" || next.length === 0 || next.length > 2048) return HOME_PATH;
  if (UNSAFE_CHARS.test(next) || !next.startsWith("/") || next.startsWith("//")) return HOME_PATH;

  let url: URL;
  try {
    url = new URL(next, INTERNAL_ORIGIN);
  } catch {
    return HOME_PATH;
  }
  if (url.origin !== INTERNAL_ORIGIN) return HOME_PATH;
  return `${url.pathname}${url.search}${url.hash}`;
}

/**
 * Comprobación optimista del proxy (solo mira si hay un JWT válido en la
 * cookie). `null` = dejar pasar; string = redirigir a esa ruta. La
 * comprobación que decide el acceso a los datos es requireUser() (DAL).
 */
export function routeRedirect(pathname: string, search: string, hasValidToken: boolean): string | null {
  if (!hasValidToken && !isPublicPath(pathname)) {
    const next = `${pathname}${search}`;
    return next === "/" ? LOGIN_PATH : `${LOGIN_PATH}?next=${encodeURIComponent(next)}`;
  }
  return null;
}
