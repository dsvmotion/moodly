import { getTranslations } from "next-intl/server";
import { disableMfa } from "@/app/app/mfa-actions";
import { MfaEnroll } from "@/components/mfa/mfa-enroll";
import { hasVerifiedFactor, requireUser } from "@/lib/auth/session";
import { getScopeContext } from "@/lib/scope-data";

// Seguridad de la cuenta: verificación en dos pasos (TOTP). Quien administra una
// organización la necesita para hacer cambios (migración admin_mfa). Sin diseño (tarea 4).
export default async function SecurityPage() {
  const user = await requireUser();
  const context = await getScopeContext();
  const t = await getTranslations("security");
  const enabled = hasVerifiedFactor(user);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">{t("title")}</h1>

      <section aria-labelledby="mfa" className="flex flex-col gap-3">
        <h2 id="mfa" className="font-semibold">
          {t("mfa")}
        </h2>
        <p data-testid="mfa-status">{enabled ? t("on") : t("off")}</p>
        {!enabled && context.role === "org_admin" ? (
          <p role="note" data-testid="mfa-required" className="text-sm">
            {t("requiredForAdmins")}
          </p>
        ) : null}
        {enabled ? (
          <form action={disableMfa}>
            <button type="submit" className="rounded-md border px-3 py-1.5">
              {t("disable")}
            </button>
          </form>
        ) : (
          <MfaEnroll />
        )}
      </section>
    </div>
  );
}
