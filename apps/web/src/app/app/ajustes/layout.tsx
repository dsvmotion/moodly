import type { ReactNode } from "react";
import { SettingsNav } from "@/components/settings-nav";

// Área de Ajustes (P6): navegación secundaria y la sección elegida. Como en el
// resto de la app, el layout solo pinta la estructura; cada página comprueba
// la sesión (requireUser) cerca de sus datos.
export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto grid w-full max-w-6xl gap-6 md:grid-cols-[13rem_minmax(0,1fr)] md:gap-10">
      <aside className="md:sticky md:top-0 md:self-start">
        <SettingsNav />
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
