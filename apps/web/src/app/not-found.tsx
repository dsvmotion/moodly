import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { buttonVariants } from "@repo/ui/components/button";
import { AuthShell } from "@/components/auth-shell";

// «No encontrado» fuera de la app: una dirección que no existe. Con el mismo
// marco que el login, porque aquí puede no haber sesión; el enlace lleva a la
// app, y el proxy manda al login a quien no la tiene.
export default async function NotFound() {
  const t = await getTranslations("states.notFound");
  return (
    <AuthShell title={t("title")} description={t("description")}>
      <Link href="/app" className={buttonVariants()} data-testid="not-found-home">
        {t("home")}
      </Link>
    </AuthShell>
  );
}
