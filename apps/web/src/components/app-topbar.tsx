"use client";

import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { isActive, MAIN_NAV, RECORDS_NAV, SETTINGS_NAV } from "@/lib/navigation";

/** Migas de la barra superior (MANUAL §9.2): sección y, si aplica, grupo. */
export function AppTopbar() {
  const t = useTranslations("nav");
  const tShell = useTranslations("shell");
  const pathname = usePathname();
  const record = RECORDS_NAV.find((entry) => isActive(pathname, entry.href));
  const main = MAIN_NAV.find((entry) => isActive(pathname, entry.href));
  const settings = isActive(pathname, SETTINGS_NAV.href);

  const crumbs = record
    ? [t("records"), t(record.key)]
    : main
      ? [t(main.key)]
      : settings
        ? [t("settings")]
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
