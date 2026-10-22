import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { credentialsFor } from "./helpers";

// Endurecimiento de Supabase Auth (packages/db/supabase/config.toml), comprobado
// contra el servidor de Auth real: contraseñas con minúscula, mayúscula y dígito,
// y MFA TOTP disponible. Usa un usuario poco usado por el resto de tests; un
// intento rechazado no cambia nada y el factor MFA de prueba se borra al acabar.

function authClient() {
  const url = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const key = process.env["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("Falta apps/web/.env.local: pnpm --filter @repo/web env:local");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function signedIn() {
  const supabase = authClient();
  const { email, password } = credentialsFor("a_region_manager");
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  expect(error).toBeNull();
  return supabase;
}

test("una contraseña sin mayúsculas ni dígitos se rechaza aunque sea larga", async () => {
  const supabase = await signedIn();
  const { error } = await supabase.auth.updateUser({ password: "solominusculaslarga" });
  expect(error?.code).toBe("weak_password");
});

test("MFA con app de autenticación (TOTP) disponible para cualquier usuario", async () => {
  const supabase = await signedIn();
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `e2e-${Date.now()}` });
  expect(error).toBeNull();
  if (!data) throw new Error("enroll no devolvió el factor");
  expect(data.totp.qr_code).toContain("svg");
  const unenroll = await supabase.auth.mfa.unenroll({ factorId: data.id });
  expect(unenroll.error).toBeNull();
});
