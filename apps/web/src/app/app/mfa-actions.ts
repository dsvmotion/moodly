"use server";

import { BRAND_NAME } from "@repo/config";
import { getTranslations } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { verifyTotp } from "@/lib/auth/mfa";
import { requireUser } from "@/lib/auth/session";
import { securityEvent } from "@/lib/observability/logger";
import { createClient } from "@/lib/supabase/server";
import { idSchema, totpCodeSchema } from "@/lib/validation";

// Alta y baja del segundo factor (TOTP) de la propia cuenta. Lo hace Supabase
// Auth con la sesión de la persona: aquí solo se validan formas. Para quitar un
// factor ya verificado, Auth exige una sesión aal2 (requireUser también).

const SECURITY_PATH = "/app/ajustes/seguridad";

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

export async function disableMfa(): Promise<void> {
  const user = await requireUser();
  const supabase = await createClient();
  for (const factor of user.factors ?? []) await supabase.auth.mfa.unenroll({ factorId: factor.id });
  // La sesión vuelve a aal1 al renovar el token.
  await supabase.auth.refreshSession();
  securityEvent("auth.mfa_disabled", { userId: user.id });
  revalidatePath("/app", "layout");
  redirect(SECURITY_PATH);
}
