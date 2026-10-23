"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@repo/ui/lib/utils";
import { isActive, SETTINGS_GROUPS } from "@/lib/navigation";
import { SCOPE_PARAM, withScope } from "@/lib/scope";

/**
 * Navegación secundaria de Ajustes (P6, MANUAL §9.4), agrupada como el
 * prototipo: Personal, Equipo y permisos, Tu negocio, IA y conexiones y
 * Seguridad. En pantallas estrechas va encima del contenido.
 */
export function SettingsNav() {
  const t = useTranslations("settings");
  const pathname = usePathname();
  const scope = useSearchParams().get(SCOPE_PARAM);

  return (
    <nav aria-label={t("label")} data-testid="settings-nav" className="flex flex-col gap-4 text-sm">
      {SETTINGS_GROUPS.map((group) => (
        <div key={group.key} className="flex flex-col gap-0.5">
          {/* Título del grupo sin ser encabezado: el h1 de la página va después en el DOM. */}
          <p id={`settings-group-${group.key}`} className="px-2 pb-1 text-xs font-medium text-muted-foreground">
            {t(`groups.${group.key}`)}
          </p>
          <ul aria-labelledby={`settings-group-${group.key}`} className="flex flex-col gap-0.5">
            {group.sections.map((section) => {
              const active = isActive(pathname, section.href);
              return (
                <li key={section.key}>
                  <Link
                    href={withScope(section.href, scope)}
                    aria-current={active ? "page" : undefined}
                    data-testid={`settings-nav-${section.key}`}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent [&_svg]:size-4 [&_svg]:shrink-0",
                      active ? "bg-accent font-medium text-accent-foreground" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <section.icon aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate">{t(`sections.${section.key}`)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
