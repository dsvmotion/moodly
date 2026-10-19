import type { Database } from "@repo/db";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { routeRedirect } from "./lib/auth/routes";
import { supabasePublicEnv } from "./lib/supabase/env";

// Proxy (antes middleware en Next.js ≤15): refresca la sesión de Supabase en
// cada petición y protege las rutas privadas. Usa getClaims(), que valida la
// firma del JWT; nunca getSession() en servidor (lee la cookie sin validarla).
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, publishableKey } = supabasePublicEnv();

  const supabase = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
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
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|offline.html|icons/).*)"],
};
