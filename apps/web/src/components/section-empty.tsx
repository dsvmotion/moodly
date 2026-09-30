import { getTranslations } from "next-intl/server";
import { EmptyState } from "@repo/ui/components/empty-state";
import { requireUser } from "@/lib/auth/session";
import { MAIN_NAV, RECORDS_NAV } from "@/lib/navigation";

/**
 * Sección que aún no tiene contenido (MANUAL §9.2): título y estado vacío que
 * explica qué habrá aquí. Sin datos inventados. Comprueba la sesión en la
 * propia página (DAL), como el resto de páginas protegidas.
 */
export async function SectionEmpty({ section }: { section: string }) {
  await requireUser();
  const t = await getTranslations("sections");
  const Icon = [...MAIN_NAV, ...RECORDS_NAV].find((entry) => entry.key === section)?.icon;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <h1 className="text-xl font-semibold">{t(`${section}.title`)}</h1>
      <EmptyState
        data-testid="section-empty"
        icon={Icon ? <Icon /> : undefined}
        title={t(`${section}.title`)}
        description={t(`${section}.description`)}
      />
    </div>
  );
}
