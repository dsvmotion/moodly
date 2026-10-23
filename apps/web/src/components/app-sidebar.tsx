"use client";

import { LogOutIcon, MonitorIcon, MoonIcon, SunIcon } from "@repo/ui/lib/icons";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useTransition, type ReactNode } from "react";
import { Sidebar, SidebarItem, SidebarSection, useSidebar } from "@repo/ui/components/sidebar";
import { cn } from "@repo/ui/lib/utils";
import { AGENTS_NAV, isActive, MAIN_NAV, RECORDS_NAV, SETTINGS_NAV, type NavItem } from "@/lib/navigation";
import type { Theme } from "@/lib/preferences";
import { SCOPE_PARAM, withScope } from "@/lib/scope";
import { setLocale, setSidebarCollapsed, setTheme } from "@/app/preferences-actions";
import { LOCALES } from "@/i18n/config";

/**
 * Barra lateral de la app (MANUAL §9.2). Control (organización y alcance) y
 * acceso rápido llegan como `header`; aquí van la navegación principal,
 * agentes, registros, vistas guardadas, favoritos, recientes y el pie.
 * Sin contadores ni elementos inventados: lo que aún no existe se dice.
 */
export function AppSidebar({
  header,
  userEmail,
  signOutAction,
  theme,
  defaultCollapsed,
}: {
  header: ReactNode;
  userEmail: string;
  signOutAction: () => Promise<void>;
  theme: Theme;
  defaultCollapsed: boolean;
}) {
  const t = useTranslations();
  const pathname = usePathname();
  // El alcance elegido viaja con la navegación (MANUAL §9.4: estado en la URL).
  const scope = useSearchParams().get(SCOPE_PARAM);

  const item = (entry: NavItem) => (
    <SidebarItem key={entry.key} icon={<entry.icon />} active={isActive(pathname, entry.href)}>
      <Link href={withScope(entry.href, scope)} data-testid={`nav-${entry.key}`}>
        {t(`nav.${entry.key}`)}
      </Link>
    </SidebarItem>
  );

  return (
    <Sidebar
      label={t("shell.sidebar")}
      defaultCollapsed={defaultCollapsed}
      onCollapsedChange={(collapsed) => void setSidebarCollapsed(collapsed)}
      collapseLabels={{ collapse: t("shell.collapse"), expand: t("shell.expand") }}
      header={header}
      footer={<SidebarFooter userEmail={userEmail} signOutAction={signOutAction} theme={theme} settings={item(SETTINGS_NAV)} />}
    >
      <SidebarSection data-testid="nav-main">{MAIN_NAV.map(item)}</SidebarSection>
      <SidebarSection title={t("nav.agents")} data-testid="nav-agents">
        {AGENTS_NAV.map((agent) => (
          <SidebarItem
            key={agent.key}
            icon={<span className={cn("size-2.5 rounded-full", agent.dotClass)} />}
            active={isActive(pathname, agent.href)}
          >
            <Link href={withScope(agent.href, scope)} data-testid={`nav-agent-${agent.key}`}>
              {t(`nav.agentTypes.${agent.key}`)}
            </Link>
          </SidebarItem>
        ))}
      </SidebarSection>
      <SidebarSection title={t("nav.records")} data-testid="nav-records">
        {RECORDS_NAV.map(item)}
      </SidebarSection>
      <SidebarSection title={t("nav.savedViews")} defaultOpen={false} data-testid="nav-saved-views">
        <EmptyNote>{t("sidebarEmpty.savedViews")}</EmptyNote>
      </SidebarSection>
      <SidebarSection title={t("nav.favorites")} defaultOpen={false} data-testid="nav-favorites">
        <EmptyNote>{t("sidebarEmpty.favorites")}</EmptyNote>
      </SidebarSection>
      <SidebarSection title={t("nav.recent")} defaultOpen={false} data-testid="nav-recent">
        <EmptyNote>{t("sidebarEmpty.recent")}</EmptyNote>
      </SidebarSection>
    </Sidebar>
  );
}

function EmptyNote({ children }: { children: ReactNode }) {
  const { collapsed } = useSidebar();
  if (collapsed) return null;
  return <li className="px-2 py-1 text-xs text-sidebar-muted-foreground">{children}</li>;
}

function SidebarFooter({
  userEmail,
  signOutAction,
  theme,
  settings,
}: {
  userEmail: string;
  signOutAction: () => Promise<void>;
  theme: Theme;
  settings: ReactNode;
}) {
  const t = useTranslations("nav");
  const { collapsed } = useSidebar();
  const [pending, startTransition] = useTransition();
  const themes: Array<{ value: Theme; label: string; icon: ReactNode }> = [
    { value: "system", label: t("themeSystem"), icon: <MonitorIcon className="size-3.5" aria-hidden="true" /> },
    { value: "light", label: t("themeLight"), icon: <SunIcon className="size-3.5" aria-hidden="true" /> },
    { value: "dark", label: t("themeDark"), icon: <MoonIcon className="size-3.5" aria-hidden="true" /> },
  ];

  return (
    <>
      <ul className="flex flex-col gap-0.5">{settings}</ul>
      <div
        role="radiogroup"
        aria-label={t("theme")}
        data-testid="theme-switcher"
        className={cn("flex gap-0.5 rounded-md bg-sidebar-accent/60 p-0.5", collapsed && "flex-col")}
      >
        {themes.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={theme === option.value}
            aria-label={option.label}
            title={option.label}
            disabled={pending}
            onClick={() => startTransition(() => setTheme(option.value))}
            className={cn(
              "flex h-7 flex-1 items-center justify-center rounded text-sidebar-muted-foreground hover:text-sidebar-accent-foreground",
              theme === option.value && "bg-sidebar text-sidebar-accent-foreground shadow-sm",
            )}
          >
            {option.icon}
          </button>
        ))}
      </div>
      <LanguageSwitcher />
      <div className={cn("flex items-center gap-2 px-2 py-1", collapsed && "flex-col px-0")}>
        <span data-testid="current-user" className={cn("min-w-0 flex-1 truncate text-xs text-sidebar-muted-foreground", collapsed && "sr-only")}>
          {userEmail}
        </span>
        <form action={signOutAction}>
          <button
            type="submit"
            aria-label={t("signOut")}
            title={t("signOut")}
            className="flex size-7 items-center justify-center rounded-md text-sidebar-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <LogOutIcon className="size-4" aria-hidden="true" />
          </button>
        </form>
      </div>
    </>
  );
}

/** Idioma de la interfaz (MANUAL §9.9): cada opción en su propio idioma. */
function LanguageSwitcher() {
  const t = useTranslations("language");
  const locale = useLocale();
  const { collapsed } = useSidebar();
  const [pending, startTransition] = useTransition();

  return (
    <div
      role="radiogroup"
      aria-label={t("label")}
      data-testid="language-switcher"
      className={cn("flex gap-0.5 rounded-md bg-sidebar-accent/60 p-0.5", collapsed && "flex-col")}
    >
      {LOCALES.map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          lang={option}
          aria-checked={locale === option}
          aria-label={t(option)}
          title={t(option)}
          disabled={pending}
          onClick={() => startTransition(() => setLocale(option))}
          className={cn(
            "flex h-7 flex-1 items-center justify-center rounded text-xs font-medium uppercase text-sidebar-muted-foreground hover:text-sidebar-accent-foreground",
            locale === option && "bg-sidebar text-sidebar-accent-foreground shadow-sm",
          )}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
