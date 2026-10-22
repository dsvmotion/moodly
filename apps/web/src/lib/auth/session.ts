import "server-only";
import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { LOGIN_PATH, MFA_PATH } from "./routes";

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

/** ¿Tiene la persona un segundo factor (TOTP) activado y verificado? */
export function hasVerifiedFactor(user: User): boolean {
  return (user.factors ?? []).some((factor) => factor.status === "verified");
}

// Nivel de la sesión: aal1 (solo contraseña) o aal2 (segundo factor verificado).
// Sale del claim `aal` del JWT, con la firma comprobada por getClaims(). Se usa
// siempre después de getCurrentUser(), que ya ha confirmado que la sesión vive.
export const getSessionAal = cache(async (): Promise<"aal1" | "aal2"> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return data?.claims.aal === "aal2" ? "aal2" : "aal1";
});

/**
 * Usuario autenticado con sesión viva; si no, redirige al login. Quien tiene un
 * segundo factor activado no pasa hasta completarlo (migración admin_mfa: un
 * org_admin necesita aal2 para cualquier cambio, y RLS lo exige igualmente).
 */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect(LOGIN_PATH);
  if (hasVerifiedFactor(user) && (await getSessionAal()) !== "aal2") redirect(MFA_PATH);
  return user;
}
