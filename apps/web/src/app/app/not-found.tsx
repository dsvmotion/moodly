import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { buttonVariants } from "@repo/ui/components/button";
import { EmptyState } from "@repo/ui/components/empty-state";
import { SearchXIcon } from "@repo/ui/lib/icons";

// «No encontrado» dentro de la app (revisión del diseño §4: estados vacío, de
// error y sin permiso). Lo pinta cualquier página de /app que llama a
// notFound(): una conversación, un agente o una sección que no existe o que la
// persona no puede ver. No distingue entre las dos cosas: decir «existe pero no
// es tuya» ya sería dar información.
export default async function AppNotFound() {
  const t = await getTranslations("states.notFound");
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <h1 className="text-xl font-semibold">{t("title")}</h1>
      <EmptyState
        data-testid="not-found"
        icon={<SearchXIcon />}
        title={t("heading")}
        description={t("description")}
        action={
          <Link href="/app" className={buttonVariants({ variant: "outline" })}>
            {t("home")}
          </Link>
        }
      />
    </div>
  );
}
