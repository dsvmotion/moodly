"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { AppShell } from "@repo/ui/components/app-shell";
import { CommandCenterProvider } from "./app-command-center";

/** AppShell con los textos traducidos y la paleta de comandos (montada una sola vez). */
export function AppFrame({ sidebar, topbar, children }: { sidebar: ReactNode; topbar: ReactNode; children: ReactNode }) {
  const t = useTranslations("shell");
  return (
    <CommandCenterProvider>
      <AppShell
        sidebar={sidebar}
        topbar={topbar}
        labels={{ skipToContent: t("skipToContent"), openMenu: t("openMenu"), menu: t("menu") }}
      >
        {children}
      </AppShell>
    </CommandCenterProvider>
  );
}
