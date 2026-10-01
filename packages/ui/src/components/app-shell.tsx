"use client";

import { MenuIcon } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "@repo/ui/components/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@repo/ui/components/sheet";

/**
 * Estructura de la aplicación (MANUAL §9.2): barra lateral a la izquierda y
 * panel principal a la derecha con su barra superior. En móvil la barra
 * lateral se abre como panel desde un botón de menú.
 */
export function AppShell({
  sidebar,
  topbar,
  children,
  labels,
}: {
  sidebar: ReactNode;
  topbar?: ReactNode;
  children: ReactNode;
  labels: { skipToContent: string; openMenu: string; menu: string; closeMenu: string };
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div data-slot="app-shell" className="flex h-dvh overflow-hidden bg-background">
      <a
        href="#main-content"
        className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        {labels.skipToContent}
      </a>

      <div className="hidden md:flex">{sidebar}</div>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" closeLabel={labels.closeMenu} className="w-72 max-w-[85vw] p-0" onClick={(event) => {
          // Cerrar al navegar desde el menú móvil.
          if ((event.target as HTMLElement).closest("a")) setMobileOpen(false);
        }}>
          <SheetTitle className="sr-only">{labels.menu}</SheetTitle>
          <SheetDescription className="sr-only">{labels.menu}</SheetDescription>
          {sidebar}
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-3 md:px-6">
          <Button
            variant="ghost"
            size="icon-sm"
            className="md:hidden"
            aria-label={labels.openMenu}
            onClick={() => setMobileOpen(true)}
          >
            <MenuIcon aria-hidden="true" />
          </Button>
          <div className="flex min-w-0 flex-1 items-center gap-2">{topbar}</div>
        </header>
        <main id="main-content" tabIndex={-1} className="min-h-0 flex-1 overflow-y-auto p-4 outline-none md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
