import { BRAND_NAME } from "@repo/config";
import { cn } from "@repo/ui/lib/utils";

// Logotipo de la marca (auditoría del frontend, F-12). Se pinta con el color de
// fondo que reciba (`className`, p. ej. bg-foreground) usando el SVG como
// máscara: un solo archivo vale para el tema claro y el oscuro. Nombre
// accesible: BRAND_NAME.
const LOGO_MASK = {
  maskImage: "url(/icons/logo.svg)",
  WebkitMaskImage: "url(/icons/logo.svg)",
  maskSize: "contain",
  WebkitMaskSize: "contain",
  maskRepeat: "no-repeat",
  WebkitMaskRepeat: "no-repeat",
} as const;

export function BrandLogo({ className }: { className?: string }) {
  return <span role="img" aria-label={BRAND_NAME} className={cn("block", className)} style={LOGO_MASK} />;
}
