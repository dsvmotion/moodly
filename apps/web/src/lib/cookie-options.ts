import { PREFERENCE_COOKIE_MAX_AGE } from "./preferences";

// Cookies propias de la app (preferencias y organización activa; auditoría
// R-24): httpOnly, SameSite=Lax y Secure cuando la petición llegó por https. En
// local y en los e2e se sirve por http, y el navegador no guardaría una cookie
// Secure.

/** ¿Llegó la petición por https? Detrás del proxy de Vercel, por x-forwarded-proto (como la CSP del proxy). */
export function isHttpsRequest(headers: Headers): boolean {
  return headers.get("x-forwarded-proto") === "https";
}

export function appCookieOptions(https: boolean) {
  return { path: "/", maxAge: PREFERENCE_COOKIE_MAX_AGE, sameSite: "lax", httpOnly: true, secure: https } as const;
}

/**
 * Cookies de sesión de Supabase (auditoría R-29): httpOnly, porque el navegador
 * nunca habla con Supabase (connect-src 'self'; todo pasa por el servidor), y
 * Secure por https. El resto, los valores por defecto de @supabase/ssr.
 */
export function sessionCookieOptions(https: boolean) {
  return { httpOnly: true, secure: https } as const;
}
