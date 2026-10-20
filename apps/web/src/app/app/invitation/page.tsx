import { BRAND_NAME } from "@repo/config";
import { getTranslations } from "next-intl/server";
import { AcceptForm } from "@/components/invitations/accept-form";
import { requireUser } from "@/lib/auth/session";

// Aceptar una invitación. Sin sesión, el proxy lleva al login y vuelve aquí con
// el mismo enlace. La invitación solo se acepta con el botón (POST), y solo si
// es para el email de quien ha entrado.
export default async function InvitationPage({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  const user = await requireUser();
  const t = await getTranslations("invitations.accept");
  const raw = (await searchParams).token;
  const token = typeof raw === "string" ? raw : "";

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4">
      <h1 className="text-xl font-semibold">{t("title")}</h1>
      {token ? (
        <>
          <p>{t("body", { brand: BRAND_NAME, email: user.email ?? "" })}</p>
          <AcceptForm token={token} />
        </>
      ) : (
        <p role="alert">{t("invalid")}</p>
      )}
    </div>
  );
}
