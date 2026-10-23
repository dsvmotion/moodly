"use client";

import Link from "next/link";
import { useSidebar } from "@repo/ui/components/sidebar";
import { BrandLogo } from "./brand-logo";

// Logotipo encima del selector de organización (auditoría del frontend, F-12),
// en el color del texto de la barra lateral. Se oculta con la barra compactada.
export function AppBrand() {
  const { collapsed } = useSidebar();
  if (collapsed) return null;
  return (
    <Link href="/app" className="flex items-center px-2 pt-1 pb-2" data-testid="app-brand">
      <BrandLogo className="h-5 w-[78px] bg-sidebar-foreground" />
    </Link>
  );
}
