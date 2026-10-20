"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { clientIp } from "@/lib/auth/client-ip";
import { safeNextPath } from "@/lib/auth/routes";
import { createClient } from "@/lib/supabase/server";

export interface SignInState {
  error: string | null;
}

const GENERIC_ERROR = "Email o contraseña incorrectos.";
const TOO_MANY = "Demasiados intentos. Espera unos minutos y vuelve a probarlo.";
const UNAVAILABLE = "No se ha podido comprobar el acceso. Inténtalo de nuevo en unos minutos.";

export async function signIn(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const email = formData.get("email");
  const password = formData.get("password");
  if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
    return { error: "Introduce email y contraseña." };
  }

  const supabase = await createClient();
  const ip = clientIp(await headers());

  // Freno a la fuerza bruta (migración login_throttle). Si no se puede
  // comprobar, no se deja intentar: fallo cerrado.
  const throttle = await supabase.rpc("login_throttle", { p_email: email, p_ip: ip });
  if (throttle.error) return { error: UNAVAILABLE };
  if (throttle.data > 0) return { error: TOO_MANY };

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    await supabase.rpc("login_record_failure", { p_email: email, p_ip: ip });
    // Mensaje genérico: no revela si el email existe.
    return { error: GENERIC_ERROR };
  }

  // Ya con sesión: borra los fallos de este email (solo los suyos).
  await supabase.rpc("login_record_success");
  redirect(safeNextPath(formData.get("next")));
}
