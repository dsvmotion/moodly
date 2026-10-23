"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { AppShell } from "@repo/ui/components/app-shell";
import type { AgentView } from "@/lib/agents";
import { CommandCenterProvider } from "./app-command-center";

/** AppShell con los textos traducidos y la paleta de comandos (montada una sola vez). */
export function AppFrame({
  sidebar,
  topbar,
  agents,
  children,
}: {
  sidebar: ReactNode;
  topbar: ReactNode;
  /** Agentes de la organización activa, para la paleta de comandos. */
  agents: readonly AgentView[];
  children: ReactNode;
}) {
  const t = useTranslations("shell");
  return (
    <CommandCenterProvider agents={agents}>
      <AppShell
        sidebar={sidebar}
        topbar={topbar}
        labels={{ skipToContent: t("skipToContent"), openMenu: t("openMenu"), menu: t("menu"), closeMenu: t("closeMenu") }}
      >
        {children}
      </AppShell>
    </CommandCenterProvider>
  );
}
