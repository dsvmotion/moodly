"use client";

import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { AGENTS_NAV, isActive, MAIN_NAV, RECORDS_NAV, SETTINGS_NAV, SETTINGS_SECTIONS } from "@/lib/navigation";

/** Migas de la barra superior (MANUAL §9.2): sección y, si aplica, grupo. */
export function AppTopbar() {
  const t = useTranslations("nav");
  const tShell = useTranslations("shell");
  const tSettings = useTranslations("settings");
  const pathname = usePathname();
  const record = RECORDS_NAV.find((entry) => isActive(pathname, entry.href));
  const main = MAIN_NAV.find((entry) => isActive(pathname, entry.href));
  const agent = AGENTS_NAV.find((entry) => isActive(pathname, entry.href));
  const agents = pathname === "/app/agentes";
  const settings = isActive(pathname, SETTINGS_NAV.href);
  const settingsSection = SETTINGS_SECTIONS.find((section) => isActive(pathname, section.href));

  const crumbs = record
    ? [t("records"), t(record.key)]
    : agent
      ? [t("agents"), t(`agentTypes.${agent.key}`)]
      : agents
        ? [t("agents")]
        : main
          ? [t(main.key)]
          : settings
            ? settingsSection
              ? [t("settings"), tSettings(`sections.${settingsSection.key}`)]
              : [t("settings")]
            : [];

  return (
    <nav aria-label={tShell("breadcrumb")} data-testid="breadcrumbs">
      <ol className="flex min-w-0 items-center gap-1.5 text-sm">
        {crumbs.map((crumb, index) => (
          <li key={crumb} className="flex min-w-0 items-center gap-1.5">
            {index > 0 ? <span className="text-muted-foreground" aria-hidden="true">/</span> : null}
            <span
              className={index === crumbs.length - 1 ? "truncate font-medium" : "truncate text-muted-foreground"}
              aria-current={index === crumbs.length - 1 ? "page" : undefined}
            >
              {crumb}
            </span>
          </li>
        ))}
      </ol>
    </nav>
  );
}
