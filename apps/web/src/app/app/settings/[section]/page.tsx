import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@repo/ui/components/empty-state";
import { requireUser } from "@/lib/auth/session";
import { settingsSectionBySlug, type SettingsSectionKey } from "@/lib/navigation";

// Secciones de Ajustes que aún no tienen contenido (MANUAL §9.4): dicen qué
// habrá y con qué llega (auditoría del frontend, F-10), sin datos inventados.
// Las secciones con contenido tienen su propia carpeta, que Next.js prefiere a
// esta ruta dinámica; aquí solo responden las pendientes.
type PendingKey = Exclude<SettingsSectionKey, "profile" | "preferences" | "team" | "organization" | "locations" | "security">;

export default async function PendingSettingsPage({ params }: { params: Promise<{ section: string }> }) {
  await requireUser();
  const section = settingsSectionBySlug((await params).section);
  if (!section || section.ready) notFound();
  const key = section.key as PendingKey;
  const t = await getTranslations("settings");

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">{t(`sections.${key}`)}</h1>
        <span data-testid="settings-pending" className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
          {t("pending.notYet")}
        </span>
      </header>
      <EmptyState
        data-testid="settings-empty"
        icon={<section.icon />}
        title={t(`pending.${key}.description`)}
        description={t("pending.arrives", { what: t(`pending.${key}.what`) })}
      />
    </div>
  );
}
