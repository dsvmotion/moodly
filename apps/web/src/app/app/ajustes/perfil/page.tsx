import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { hasVerifiedFactor, requireUser } from "@/lib/auth/session";
import { settingsSection } from "@/lib/navigation";
import { getProfileName } from "@/lib/profile-data";
import { getOrgContext } from "@/lib/scope-data";

// Ajustes → Mi perfil (P6): quién eres, en qué organizaciones y con qué rol,
// y si tienes la verificación en dos pasos. Solo lectura por ahora: cambiar el
// nombre pide antes una guarda de columnas en public.users (ADR 0003).
export default async function ProfilePage() {
  const user = await requireUser();
  const [name, { memberships }, t, tRoles] = await Promise.all([
    getProfileName(user.id),
    getOrgContext(),
    getTranslations("profilePage"),
    getTranslations("records.roles"),
  ]);
  const mfa = hasVerifiedFactor(user);

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <h1 className="text-xl font-semibold">{t("title")}</h1>

      <section aria-labelledby="profile-account" className="flex flex-col gap-3">
        <h2 id="profile-account" className="font-semibold">
          {t("account")}
        </h2>
        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[10rem_1fr]">
          <dt className="text-muted-foreground">{t("name")}</dt>
          <dd>
            <span data-testid="profile-name">{name?.trim() || t("noName")}</span>
            <span className="block text-xs text-muted-foreground">{t("nameReadOnly")}</span>
          </dd>
          <dt className="text-muted-foreground">{t("email")}</dt>
          <dd data-testid="profile-email">{user.email}</dd>
          <dt className="text-muted-foreground">{t("mfa")}</dt>
          <dd>
            <span data-testid="profile-mfa">{mfa ? t("mfaOn") : t("mfaOff")}</span>
            {" · "}
            <Link href={settingsSection("security").href} className="underline underline-offset-4">
              {t("manageMfa")}
            </Link>
          </dd>
        </dl>
      </section>

      <section aria-labelledby="profile-organizations" className="flex flex-col gap-3">
        <h2 id="profile-organizations" className="font-semibold">
          {t("organizations")}
        </h2>
        {memberships.length > 0 ? (
          <table className="w-full max-w-xl text-left text-sm">
            <thead className="text-muted-foreground">
              <tr>
                <th scope="col" className="py-1.5 font-medium">
                  {t("organization")}
                </th>
                <th scope="col" className="py-1.5 font-medium">
                  {t("role")}
                </th>
              </tr>
            </thead>
            <tbody>
              {memberships.map((membership) => (
                <tr key={membership.organizationId} data-testid="profile-membership" className="border-t">
                  <td className="py-1.5">{membership.organizationName}</td>
                  <td className="py-1.5">{tRoles(membership.role)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-muted-foreground">{t("noOrganizations")}</p>
        )}
      </section>
    </div>
  );
}
