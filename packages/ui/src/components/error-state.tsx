import type { ComponentProps, ReactNode } from "react";
import { cn } from "@repo/ui/lib/utils";

/**
 * Estado de error: dice qué falló y ofrece reintentar. Nunca oculta el fallo ni
 * lo disfraza de estado vacío. `role="alert"` para que el lector lo anuncie.
 */
export function ErrorState({
  icon,
  title,
  description,
  action,
  className,
  ...props
}: Omit<ComponentProps<"div">, "title"> & {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div
      data-slot="error-state"
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-6 py-12 text-center",
        className,
      )}
      {...props}
    >
      {icon ? (
        <div className="mb-1 flex size-10 items-center justify-center rounded-full bg-destructive/10 text-destructive [&_svg]:size-5" aria-hidden="true">
          {icon}
        </div>
      ) : null}
      <p className="text-sm font-medium">{title}</p>
      {description ? <p className="max-w-sm text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
