import type { Database } from "@repo/db";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { routeRedirect } from "./lib/auth/routes";
import { sessionCookieOptions } from "./lib/cookie-options";
import { contentSecurityPolicy, createNonce } from "./lib/security/headers";
import { supabasePublicEnv } from "./lib/supabase/env";

// Proxy (antes middleware en Next.js ≤15): refresca la sesión de Supabase en
// cada petición y protege las rutas privadas. Usa getClaims(), que valida la
// firma del JWT; nunca getSession() en servidor (lee la cookie sin validarla).
//
// También pone la CSP con un nonce nuevo en cada petición: Next lo lee de la
// cabecera de la petición y lo añade a sus propios scripts (lib/security/headers.ts).
export async function proxy(request: NextRequest) {
  const https = request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";
  const csp = contentSecurityPolicy(createNonce(), { dev: process.env.NODE_ENV === "development", https });
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("Content-Security-Policy", csp);
  const pass = () => {
    const next = NextResponse.next({ request: { headers: requestHeaders } });
    next.headers.set("Content-Security-Policy", csp);
    return next;
  };

  let response = pass();
  const { url, publishableKey } = supabasePublicEnv();

  const supabase = createServerClient<Database>(url, publishableKey, {
    cookieOptions: sessionCookieOptions(https),
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        requestHeaders.set("cookie", request.headers.get("cookie") ?? "");
        response = pass();
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const target = routeRedirect(request.nextUrl.pathname, request.nextUrl.search, Boolean(data?.claims));
  if (!target) return response;

  // Conserva las cookies de sesión refrescadas también en la redirección.
  const redirect = NextResponse.redirect(new URL(target, request.url));
  for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
  return redirect;
}

// Fuera del proxy quedan los estáticos sin datos. Los de la PWA (service
// worker, manifest, página sin conexión e iconos) también: el iPhone los pide
// sin sesión al instalar la app desde /login y no pueden redirigir al login.
// Y el tunnel de Sentry (/monitoring): recibe errores también sin sesión.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|offline.html|icons/|monitoring).*)"],
};
