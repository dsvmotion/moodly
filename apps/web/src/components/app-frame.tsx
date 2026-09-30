"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { AppShell } from "@repo/ui/components/app-shell";

/** AppShell con los textos traducidos (los componentes de @repo/ui no conocen i18n). */
export function AppFrame({ sidebar, topbar, children }: { sidebar: ReactNode; topbar: ReactNode; children: ReactNode }) {
  const t = useTranslations("shell");
  return (
    <AppShell
      sidebar={sidebar}
      topbar={topbar}
      labels={{ skipToContent: t("skipToContent"), openMenu: t("openMenu"), menu: t("menu") }}
    >
      {children}
    </AppShell>
  );
}
