import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Une clases condicionales (clsx) y resuelve conflictos de Tailwind
 * (tailwind-merge): `cn("px-2", cond && "px-4")` → "px-4". Es la utilidad
 * que usan todos los componentes de shadcn/ui (`@repo/ui/lib/utils`).
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
