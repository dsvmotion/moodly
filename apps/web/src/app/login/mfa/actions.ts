"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { clientIp } from "@/lib/auth/client-ip";
import { isTransient, verifyTotp } from "@/lib/auth/mfa";
import { LOGIN_PATH, safeNextPath } from "@/lib/auth/routes";
import { getCurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export interface MfaState {
  error: string | null;
}

const BAD_CODE = "El código no es correcto. Prueba con el que muestra ahora tu aplicación.";
const INVALID = "Escribe el código de 6 cifras de tu aplicación de autenticación.";
const TOO_MANY = "Demasiados intentos. Espera unos minutos y vuelve a probarlo.";
const UNAVAILABLE = "No se ha podido comprobar el acceso. Inténtalo de nuevo en unos minutos.";

// Paso del segundo factor tras la contraseña. Los códigos fallidos cuentan en el
// mismo freno que las contraseñas (migración login_throttle, por email e IP): un
// código de 6 cifras no se puede probar a fuerza bruta. Si el freno no responde,
// no se deja intentar (fallo cerrado).
export async function verifyMfa(_prev: MfaState, formData: FormData): Promise<MfaState> {
  const raw = formData.get("code");
  const code = typeof raw === "string" ? raw.replace(/\s+/g, "") : "";
  if (!/^\d{6}$/.test(code)) return { error: INVALID };

  const user = await getCurrentUser();
  if (!user) redirect(LOGIN_PATH);
  const next = safeNextPath(formData.get("next"));
  const factor = (user.factors ?? []).find((f) => f.status === "verified" && f.factor_type === "totp");
  if (!factor) redirect(next);

  const key = process.env["LOGIN_THROTTLE_KEY"];
  if (!key || !user.email) return { error: UNAVAILABLE };
  const supabase = await createClient();
  const ip = clientIp(await headers());

  const throttle = await supabase.rpc("login_throttle", { p_email: user.email, p_ip: ip, p_key: key });
  if (throttle.error) return { error: UNAVAILABLE };
  if (throttle.data > 0) return { error: TOO_MANY };

  const { error } = await verifyTotp(supabase, factor.id, code);
  if (error && isTransient(error)) return { error: UNAVAILABLE };
  if (error) {
    await supabase.rpc("login_record_failure", { p_email: user.email, p_ip: ip, p_key: key });
    return { error: BAD_CODE };
  }

  await supabase.rpc("login_record_success");
  redirect(next);
}
