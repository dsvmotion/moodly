"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { createContext, useContext, useState, type ReactNode } from "react";
import { CommandPalette, type CommandPaletteGroup } from "@repo/ui/components/command-palette";
import { GlobalSearch } from "@repo/ui/components/global-search";
import { MAIN_NAV, RECORDS_NAV, SETTINGS_NAV, type NavItem } from "@/lib/navigation";
import { SCOPE_PARAM, withScope } from "@/lib/scope";

const CommandCenterContext = createContext<() => void>(() => {});

/**
 * Acceso rápido (MANUAL §9.2): paleta de comandos (⌘K / Ctrl+K, o "/" fuera
 * de campos de texto). Se monta UNA vez en el marco de la app, con su escucha
 * de teclado; la barra lateral (que en móvil se monta también en el menú) solo
 * pone el botón. Por ahora navega entre secciones conservando el alcance.
 */
export function CommandCenterProvider({ children }: { children: ReactNode }) {
  const t = useTranslations();
  const router = useRouter();
  const scope = useSearchParams().get(SCOPE_PARAM);
  const [open, setOpen] = useState(false);

  const toItem = (entry: NavItem) => ({
    id: entry.key,
    label: t(`nav.${entry.key}`),
    icon: <entry.icon aria-hidden="true" />,
    keywords: [entry.key, entry.href],
    onSelect: () => router.push(withScope(entry.href, scope)),
  });

  const groups: CommandPaletteGroup[] = [
    { heading: t("command.navigation"), items: MAIN_NAV.map(toItem) },
    { heading: t("command.records"), items: RECORDS_NAV.map(toItem) },
    { heading: t("command.settings"), items: [toItem(SETTINGS_NAV)] },
  ];

  return (
    <CommandCenterContext.Provider value={() => setOpen(true)}>
      {children}
      <CommandPalette
        open={open}
        onOpenChange={setOpen}
        groups={groups}
        labels={{
          title: t("command.title"),
          description: t("command.description"),
          placeholder: t("command.placeholder"),
          empty: t("command.empty"),
        }}
      />
    </CommandCenterContext.Provider>
  );
}

/** Botón "Buscar" de la barra lateral: abre la paleta del marco. */
export function AppSearchButton() {
  const t = useTranslations("shell");
  const open = useContext(CommandCenterContext);
  return <GlobalSearch onOpen={open} labels={{ search: t("search"), shortcut: t("searchShortcut") }} />;
}
