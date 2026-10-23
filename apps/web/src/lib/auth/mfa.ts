import type { SupabaseClient } from "@supabase/supabase-js";

// Verificación de un código TOTP con reintentos ante fallos transitorios de
// Supabase Auth. Dos verificaciones simultáneas de la misma persona (dos
// pestañas o dispositivos) pueden chocar en Auth ("deadlock detected", HTTP 500):
// eso no es un código incorrecto, así que se reintenta y no cuenta en el freno.
// Un código incorrecto responde 4xx y no se reintenta.

interface AuthErrorLike {
  status?: number | undefined;
}

/** ¿Fallo de Auth o de red (5xx, o status 0/ausente: auth-js marca así los fallos de fetch) y no de credenciales? */
export function isTransient(error: AuthErrorLike): boolean {
  const status = error.status ?? 0;
  return status === 0 || status >= 500;
}

export async function verifyTotp(
  supabase: SupabaseClient,
  factorId: string,
  code: string,
  { attempts = 4, sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)) } = {},
) {
  let result = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
  for (let attempt = 1; attempt < attempts && result.error && isTransient(result.error); attempt++) {
    await sleep(100 * attempt + Math.floor(Math.random() * 150));
    result = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
  }
  return result;
}
