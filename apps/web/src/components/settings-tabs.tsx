import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { SETTINGS_SECTIONS, type SettingsSectionKey } from "@/lib/navigation";

// Secciones de Ajustes con datos reales hoy (MANUAL §9.4, rutas del ADR 0023).
// El área completa con navegación secundaria (P6, 13 secciones) es el siguiente
// paso (auditoría del frontend 2026-10-23, F-3).
export async function SettingsTabs({ current }: { current: SettingsSectionKey }) {
  const t = await getTranslations("settingsTabs");
  return (
    <nav aria-label={t("label")} data-testid="settings-tabs" className="flex gap-3 border-b pb-2 text-sm">
      {SETTINGS_SECTIONS.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={tab.key === current ? "page" : undefined}
          className={tab.key === current ? "font-semibold underline" : "underline-offset-4 hover:underline"}
        >
          {t(tab.key)}
        </Link>
      ))}
    </nav>
  );
}
