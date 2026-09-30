import "server-only";
import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { LOGIN_PATH } from "./routes";

// Capa de acceso (DAL, guía de autenticación de Next.js 16): la comprobación
// de sesión que decide el acceso se hace aquí, cerca de los datos, no solo en
// el proxy ni en un layout (que no se vuelve a renderizar al navegar).
//
// Usa getUser() y no getClaims(): getClaims() valida la firma del JWT (en
// local, con claves asimétricas, sin consultar al servidor), así que un token
// copiado sigue siendo válido tras cerrar sesión hasta que caduca. getUser()
// pregunta al servidor de Auth, que responde session_not_found si la sesión se
// cerró. Nunca getSession() en servidor: no revalida el token.
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
});

/** Usuario autenticado con sesión viva; si no, redirige al login. */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect(LOGIN_PATH);
  return user;
}
