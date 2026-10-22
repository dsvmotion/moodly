import Link from "next/link";
import { getTranslations } from "next-intl/server";

const TABS = [
  { key: "organization", href: "/app/settings/organization" },
  { key: "security", href: "/app/settings/security" },
] as const;

// Pestañas de Ajustes (organización y seguridad de la cuenta). Sin diseño (tarea 4).
export async function SettingsTabs({ current }: { current: (typeof TABS)[number]["key"] }) {
  const t = await getTranslations("settingsTabs");
  return (
    <nav aria-label={t("label")} className="flex gap-3 border-b pb-2 text-sm">
      {TABS.map((tab) => (
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
