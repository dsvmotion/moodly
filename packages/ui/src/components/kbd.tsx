import type { ComponentProps } from "react";
import { cn } from "@repo/ui/lib/utils";

/** Tecla o atajo de teclado (p. ej. ⌘K, /). */
export function Kbd({ className, ...props }: ComponentProps<"kbd">) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-muted px-1 font-mono text-[11px] text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}
