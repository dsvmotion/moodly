"use client";

import type { ReactNode } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@repo/ui/components/sheet";
import { useRestoreFocus } from "@repo/ui/hooks/use-restore-focus";

/**
 * Panel lateral de vista previa (P4, MANUAL §9.3): abre el detalle de un
 * registro sin salir de la tabla. `footer` suele llevar el enlace a la página
 * completa del registro.
 */
export function PreviewDrawer({
  open,
  onOpenChange,
  title,
  description,
  footer,
  closeLabel,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string | undefined;
  footer?: ReactNode;
  closeLabel?: string | undefined;
  children: ReactNode;
}) {
  // Se abre desde una fila de la tabla (sin Trigger): al cerrar, el foco vuelve a la fila.
  const restoreFocus = useRestoreFocus(open);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent data-testid="preview-drawer" closeLabel={closeLabel} onCloseAutoFocus={restoreFocus}>
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          {description ? <SheetDescription>{description}</SheetDescription> : <SheetDescription className="sr-only">{title}</SheetDescription>}
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        {footer ? <div className="border-t border-border pt-4">{footer}</div> : null}
      </SheetContent>
    </Sheet>
  );
}

/** Lista de atributos del registro en la vista previa. */
export function PreviewAttributes({ items }: { items: Array<{ label: string; value: ReactNode }> }) {
  return (
    <dl className="grid grid-cols-[minmax(7rem,auto)_1fr] gap-x-4 gap-y-2 text-sm">
      {items.map((item) => (
        <div key={item.label} className="contents">
          <dt className="text-muted-foreground">{item.label}</dt>
          <dd className="min-w-0 break-words">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
