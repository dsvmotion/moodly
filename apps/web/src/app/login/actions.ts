"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { clientIp } from "@/lib/auth/client-ip";
import { MFA_PATH, safeNextPath } from "@/lib/auth/routes";
import { securityEvent } from "@/lib/observability/logger";
import { createClient } from "@/lib/supabase/server";
import { signInSchema } from "@/lib/validation";

export interface SignInState {
  error: string | null;
}

const GENERIC_ERROR = "Email o contraseña incorrectos.";
const TOO_MANY = "Demasiados intentos. Espera unos minutos y vuelve a probarlo.";
const UNAVAILABLE = "No se ha podido comprobar el acceso. Inténtalo de nuevo en unos minutos.";

export async function signIn(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const parsed = signInSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: "Introduce email y contraseña." };
  const { email, password } = parsed.data;

  // Sin clave de servidor no se puede usar el freno: fallo cerrado.
  const key = process.env["LOGIN_THROTTLE_KEY"];
  if (!key) return { error: UNAVAILABLE };

  const supabase = await createClient();
  const ip = clientIp(await headers());

  // Freno a la fuerza bruta (migración login_throttle). Si no se puede
  // comprobar, no se deja intentar: fallo cerrado.
  const throttle = await supabase.rpc("login_throttle", { p_email: email, p_ip: ip, p_key: key });
  if (throttle.error) return { error: UNAVAILABLE };
  if (throttle.data > 0) {
    securityEvent("auth.login_throttled", { email, ip, wait_seconds: throttle.data });
    return { error: TOO_MANY };
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    await supabase.rpc("login_record_failure", { p_email: email, p_ip: ip, p_key: key });
    securityEvent("auth.login_failed", { email, ip });
    // Mensaje genérico: no revela si el email existe.
    return { error: GENERIC_ERROR };
  }

  const next = safeNextPath(formData.get("next"));
  // Con un segundo factor activado, la contraseña sola da una sesión aal1: falta
  // el código (y requireUser() no dejaría pasar sin él). Los fallos NO se borran
  // aquí, sino al verificar el código: si no, quien sepa la contraseña podría
  // vaciar el freno entrando de nuevo y probar códigos sin límite.
  const hasFactor = (data.user.factors ?? []).some((factor) => factor.status === "verified");
  if (hasFactor) {
    securityEvent("auth.mfa_required", { userId: data.user.id, ip });
    redirect(`${MFA_PATH}?next=${encodeURIComponent(next)}`);
  }

  // Ya con sesión completa: borra los fallos de este email (solo los suyos).
  await supabase.rpc("login_record_success");
  securityEvent("auth.login_succeeded", { userId: data.user.id, ip });
  redirect(next);
}
