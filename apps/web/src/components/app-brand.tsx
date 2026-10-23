"use client";

import { BRAND_NAME } from "@repo/config";
import Link from "next/link";
import { useSidebar } from "@repo/ui/components/sidebar";

// Logotipo encima del selector de organización (auditoría del frontend, F-12).
// Se pinta con el color del texto de la barra lateral usando el SVG como
// máscara: un solo archivo vale para el tema claro y el oscuro. Se oculta con la
// barra compactada.
const LOGO_MASK = {
  maskImage: "url(/icons/logo.svg)",
  WebkitMaskImage: "url(/icons/logo.svg)",
  maskSize: "contain",
  WebkitMaskSize: "contain",
  maskRepeat: "no-repeat",
  WebkitMaskRepeat: "no-repeat",
} as const;

export function AppBrand() {
  const { collapsed } = useSidebar();
  if (collapsed) return null;
  return (
    <Link href="/app" className="flex items-center px-2 pt-1 pb-2" data-testid="app-brand">
      <span role="img" aria-label={BRAND_NAME} className="block h-5 w-[78px] bg-sidebar-foreground" style={LOGO_MASK} />
    </Link>
  );
}
