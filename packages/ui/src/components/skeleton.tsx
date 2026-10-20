import type { ComponentProps } from "react";
import { cn } from "@repo/ui/lib/utils";

/**
 * Placeholder de carga. Marca la forma del contenido que llega, no un spinner
 * vago. Usa animate-pulse, que se detiene con prefers-reduced-motion (globals.css).
 */
export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  );
}
