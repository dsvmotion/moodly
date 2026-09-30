"use client";

import { SearchIcon } from "lucide-react";
import { Kbd } from "@repo/ui/components/kbd";
import { useSidebar } from "@repo/ui/components/sidebar";
import { cn } from "@repo/ui/lib/utils";

/**
 * Acceso a la búsqueda global (MANUAL §9.2). Abre la paleta de comandos en
 * modo búsqueda; los atajos "/" y ⌘K los gestiona `CommandPalette`.
 */
export function GlobalSearch({
  onOpen,
  labels,
}: {
  onOpen: () => void;
  labels: { search: string; shortcut: string };
}) {
  const { collapsed } = useSidebar();

  return (
    <button
      type="button"
      onClick={onOpen}
      data-testid="global-search"
      aria-keyshortcuts="/ Meta+K Control+K"
      className={cn(
        "flex h-8 w-full items-center gap-2 rounded-md px-2 text-sm text-sidebar-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        collapsed && "justify-center px-0",
      )}
    >
      <SearchIcon className="size-4 shrink-0" aria-hidden="true" />
      <span className={collapsed ? "sr-only" : "flex-1 text-left"}>{labels.search}</span>
      {collapsed ? null : <Kbd aria-label={labels.shortcut}>⌘K</Kbd>}
    </button>
  );
}
