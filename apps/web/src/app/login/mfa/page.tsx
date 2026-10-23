import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Button } from "@repo/ui/components/button";
import { signOut } from "@/app/app/actions";
import { AuthShell } from "@/components/auth-shell";
import { LOGIN_PATH, safeNextPath } from "@/lib/auth/routes";
import { getCurrentUser, getSessionAal, hasVerifiedFactor } from "@/lib/auth/session";
import { MfaForm } from "./mfa-form";

// Segundo paso del login para quien tiene MFA activado. Exige la sesión de la
// contraseña (aal1); con aal2 o sin factor no hay nada que hacer aquí.
export default async function MfaPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNextPath((await searchParams).next);
  const user = await getCurrentUser();
  if (!user) redirect(LOGIN_PATH);
  if (!hasVerifiedFactor(user) || (await getSessionAal()) === "aal2") redirect(next);
  const t = await getTranslations("mfaLogin");

  return (
    <AuthShell
      title={t("title")}
      description={t("description", { email: user.email ?? "" })}
      footer={
        <form action={signOut}>
          <Button type="submit" variant="ghost" size="sm">
            {t("signOut")}
          </Button>
        </form>
      }
    >
      <MfaForm next={next} />
    </AuthShell>
  );
}
