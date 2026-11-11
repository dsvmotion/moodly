"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Sidebar, SidebarItem, SidebarSection, useSidebar } from "@repo/ui/components/sidebar";
import { cn } from "@repo/ui/lib/utils";
import type { AgentView } from "@/lib/agents";
import { isActive, MAIN_NAV, RECORDS_NAV, SETTINGS_NAV, type NavItem } from "@/lib/navigation";
import type { Theme } from "@/lib/preferences";
import { SCOPE_PARAM, withScope } from "@/lib/scope";
import { setSidebarCollapsed } from "@/app/preferences-actions";
import { AppUserMenu } from "@/components/app-user-menu";

/**
 * Barra lateral de la app (MANUAL §9.2). Control (organización y alcance) y
 * acceso rápido llegan como `header`; aquí van la navegación principal,
 * agentes, registros, vistas guardadas, favoritos, recientes y el pie
 * (Ajustes y el menú de usuario).
 * Sin contadores ni elementos inventados: lo que aún no existe se dice. Los
 * contadores son los de lo que espera a la persona (M-02), cuando hay algo.
 */
export function AppSidebar({
  header,
  agents,
  counts,
  user,
  signOutAction,
  theme,
  defaultCollapsed,
}: {
  header: ReactNode;
  /** Agentes de la organización activa (del catálogo; ninguno sin organización). */
  agents: readonly AgentView[];
  /** Lo pendiente de cada entrada de la navegación (por su clave); sin cuenta, nada. */
  counts: Partial<Record<"approvals" | "inbox", number>>;
  /** Quién es (nombre, si lo tiene, y email) y su rol en la organización activa. */
  user: { name: string | null; email: string; context: string | null };
  signOutAction: () => Promise<void>;
  theme: Theme;
  defaultCollapsed: boolean;
}) {
  const t = useTranslations();
  const pathname = usePathname();
  // El alcance elegido viaja con la navegación (MANUAL §9.4: estado en la URL).
  const scope = useSearchParams().get(SCOPE_PARAM);

  const item = (entry: NavItem) => {
    const count = entry.key === "approvals" || entry.key === "inbox" ? (counts[entry.key] ?? 0) : 0;
    return (
      <SidebarItem
        key={entry.key}
        icon={<entry.icon />}
        active={isActive(pathname, entry.href)}
        count={count}
        countLabel={() => t(`navCounts.${entry.key}`, { count })}
      >
        <Link href={withScope(entry.href, scope)} data-testid={`nav-${entry.key}`}>
          {t(`nav.${entry.key}`)}
        </Link>
      </SidebarItem>
    );
  };

  return (
    <Sidebar
      label={t("shell.sidebar")}
      defaultCollapsed={defaultCollapsed}
      onCollapsedChange={(collapsed) => void setSidebarCollapsed(collapsed)}
      collapseLabels={{ collapse: t("shell.collapse"), expand: t("shell.expand") }}
      header={header}
      footer={
        <>
          <ul className="flex flex-col gap-0.5">{item(SETTINGS_NAV)}</ul>
          <AppUserMenu {...user} theme={theme} signOutAction={signOutAction} />
        </>
      }
    >
      <SidebarSection data-testid="nav-main">{MAIN_NAV.map(item)}</SidebarSection>
      <SidebarSection title={t("nav.agents")} data-testid="nav-agents">
        {agents.length === 0 ? <EmptyNote>{t("sidebarEmpty.agents")}</EmptyNote> : null}
        {agents.map((agent) => (
          <SidebarItem
            key={agent.key}
            icon={<span className={cn("size-2.5 rounded-full", agent.dotClass)} />}
            active={isActive(pathname, agent.href)}
          >
            <Link href={withScope(agent.href, scope)} data-testid={`nav-agent-${agent.key}`}>
              {agent.label}
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
