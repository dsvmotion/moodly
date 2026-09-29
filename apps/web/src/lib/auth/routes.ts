// Política de rutas de la app, pura para poder probarla sin Next ni Supabase.
// La barrera real de datos es RLS (MANUAL §10.2); esto solo decide a dónde
// se envía a cada visitante.

export const LOGIN_PATH = "/login";
export const HOME_PATH = "/app";

/** Rutas accesibles sin sesión. Todo lo demás exige usuario autenticado. */
const PUBLIC_PATHS = new Set([LOGIN_PATH]);

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.has(pathname);
}

/**
 * Destino tras el login, solo si es una ruta interna. Evita redirecciones
 * abiertas (`//evil.test`, `https://…`, `/\evil.test`).
 */
export function safeNextPath(next: unknown): string {
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return HOME_PATH;
  }
  return next;
}

/** `null` = dejar pasar; string = redirigir a esa ruta. */
export function routeRedirect(pathname: string, search: string, isAuthenticated: boolean): string | null {
  if (!isAuthenticated && !isPublicPath(pathname)) {
    const next = `${pathname}${search}`;
    return next === "/" ? LOGIN_PATH : `${LOGIN_PATH}?next=${encodeURIComponent(next)}`;
  }
  if (isAuthenticated && pathname === LOGIN_PATH) return HOME_PATH;
  return null;
}
