import "server-only";
import type { Database } from "@repo/db";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabasePublicEnv } from "./env";

/**
 * Cliente de Supabase para Server Components y Server Actions. Usa siempre la
 * sesión (JWT) del usuario de las cookies y la clave publicable: todas las
 * consultas pasan por RLS. La app nunca usa la service role (AGENTS.md).
 */
export async function createClient() {
  const cookieStore = await cookies();
  const { url, publishableKey } = supabasePublicEnv();

  return createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Desde un Server Component no se pueden escribir cookies; el proxy
          // ya refresca la sesión en cada petición.
        }
      },
    },
  });
}
