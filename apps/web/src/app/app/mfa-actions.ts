"use server";

import { BRAND_NAME } from "@repo/config";
import { getTranslations } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { clientIp } from "@/lib/auth/client-ip";
import { isTransient, verifyTotp } from "@/lib/auth/mfa";
import { requireUser } from "@/lib/auth/session";
import { securityEvent } from "@/lib/observability/logger";
import { createClient } from "@/lib/supabase/server";
import { idSchema, totpCodeSchema } from "@/lib/validation";

// Alta y baja del segundo factor (TOTP) de la propia cuenta. Lo hace Supabase
// Auth con la sesión de la persona. Para quitar un factor ya verificado, Auth
// exige una sesión aal2 (requireUser también) y aquí, además, un código actual.

const SECURITY_PATH = "/app/settings/security";

export interface EnrollState {
  error: string | null;
  factorId: string | null;
  /** QR en SVG (data URL) con la URI otpauth:// del factor. */
  qrCode: string | null;
  /** El mismo secreto en base32, para escribirlo a mano. */
  secret: string | null;
}

const empty: EnrollState = { error: null, factorId: null, qrCode: null, secret: null };

export async function startEnrollment(): Promise<EnrollState> {
  await requireUser();
  const t = await getTranslations("security.errors");
  const supabase = await createClient();

  // Quita las altas a medias (factores sin verificar) antes de empezar otra.
  const { data: factors } = await supabase.auth.mfa.listFactors();
  for (const factor of factors?.all ?? []) {
    if (factor.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: factor.id });
  }

  const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", issuer: BRAND_NAME });
  if (error || !data) return { ...empty, error: t("enroll") };
  return { error: null, factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret };
}

export interface ConfirmState {
  error: string | null;
}

export async function confirmEnrollment(_prev: ConfirmState, formData: FormData): Promise<ConfirmState> {
  const user = await requireUser();
  const t = await getTranslations("security.errors");
  const factorId = idSchema.safeParse(formData.get("factorId"));
  const code = totpCodeSchema.safeParse(formData.get("code"));
  if (!factorId.success || !code.success) return { error: t("code") };

  const supabase = await createClient();
  // Verificar el factor deja la sesión en aal2.
  const { error } = await verifyTotp(supabase, factorId.data, code.data);
  if (error) return { error: t(error.status !== undefined && error.status < 500 ? "code" : "unavailable") };

  securityEvent("auth.mfa_enabled", { userId: user.id });
  revalidatePath("/app", "layout");
  redirect(SECURITY_PATH);
}

export interface DisableState {
  error: string | null;
}

// Quitar el segundo factor pide un código actual (auditoría R-21): una sesión
// aal2 robada no basta para desactivarlo. Los códigos fallidos cuentan en el
// mismo freno que el login (login_throttle, por email e IP); si el freno no
// responde, no se deja intentar (fallo cerrado).
export async function disableMfa(_prev: DisableState, formData: FormData): Promise<DisableState> {
  const user = await requireUser();
  const t = await getTranslations("security.errors");
  const factor = (user.factors ?? []).find((f) => f.status === "verified" && f.factor_type === "totp");
  if (!factor) redirect(SECURITY_PATH);
  const code = totpCodeSchema.safeParse(formData.get("code"));
  if (!code.success) return { error: t("code") };

  const key = process.env["LOGIN_THROTTLE_KEY"];
  if (!key || !user.email) return { error: t("unavailable") };
  const supabase = await createClient();
  const ip = clientIp(await headers());
  const throttle = await supabase.rpc("login_throttle", { p_email: user.email, p_ip: ip, p_key: key });
  if (throttle.error) return { error: t("unavailable") };
  if (throttle.data > 0) {
    securityEvent("auth.mfa_throttled", { userId: user.id, ip, wait_seconds: throttle.data });
    return { error: t("tooMany") };
  }

  const { error } = await verifyTotp(supabase, factor.id, code.data);
  if (error && isTransient(error)) return { error: t("unavailable") };
  if (error) {
    await supabase.rpc("login_record_failure", { p_email: user.email, p_ip: ip, p_key: key });
    securityEvent("auth.mfa_failed", { userId: user.id, ip });
    return { error: t("code") };
  }

  for (const enrolled of user.factors ?? []) await supabase.auth.mfa.unenroll({ factorId: enrolled.id });
  // La sesión vuelve a aal1 al renovar el token.
  await supabase.auth.refreshSession();
  securityEvent("auth.mfa_disabled", { userId: user.id });
  revalidatePath("/app", "layout");
  redirect(SECURITY_PATH);
}
