"use client";

import { XIcon } from "lucide-react";
import { Toast as ToastPrimitive } from "radix-ui";
import { useSyncExternalStore } from "react";
import { dismissToast, getToasts, subscribeToasts, type ToastVariant } from "@repo/ui/lib/toast-store";
import { cn } from "@repo/ui/lib/utils";

export { toast } from "@repo/ui/lib/toast-store";

const variantAccent: Record<ToastVariant, string> = {
  default: "border-border",
  success: "border-agent-reception/50",
  error: "border-destructive/50",
};

/**
 * Pila de toasts. Se monta una vez cerca de la raíz de la app. Lee el store con
 * useSyncExternalStore; se escribe con `toast(...)`. Sobre Toast de Radix: se
 * cierra solo a los 5 s, se puede descartar y es accesible (región aria-live).
 * Los textos llegan traducidos de la app: `label` nombra la región de avisos
 * (Radix añade el atajo, F8) y `closeLabel` el botón de cerrar.
 */
export function Toaster({ label = "Avisos ({hotkey})", closeLabel = "Cerrar" }: { label?: string; closeLabel?: string } = {}) {
  const toasts = useSyncExternalStore(subscribeToasts, getToasts, getToasts);
  return (
    <ToastPrimitive.Provider swipeDirection="right" duration={5000}>
      {toasts.map((item) => (
        <ToastPrimitive.Root
          key={item.id}
          onOpenChange={(open) => {
            if (!open) dismissToast(item.id);
          }}
          data-slot="toast"
          className={cn(
            "flex items-start gap-3 rounded-lg border bg-surface p-4 text-surface-foreground shadow-panel",
            "data-[state=open]:animate-in data-[state=open]:slide-in-from-right-full",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-80",
            "data-[swipe=end]:animate-out data-[swipe=end]:fade-out-80",
            variantAccent[item.variant],
          )}
        >
          <div className="flex-1">
            <ToastPrimitive.Title className="text-sm font-medium">{item.title}</ToastPrimitive.Title>
            {item.description ? (
              <ToastPrimitive.Description className="mt-1 text-sm text-muted-foreground">
                {item.description}
              </ToastPrimitive.Description>
            ) : null}
          </div>
          <ToastPrimitive.Close
            aria-label={closeLabel}
            className="text-muted-foreground transition-colors hover:text-foreground [&_svg]:size-4"
          >
            <XIcon />
          </ToastPrimitive.Close>
        </ToastPrimitive.Root>
      ))}
      <ToastPrimitive.Viewport label={label} className="fixed bottom-0 right-0 z-[100] flex max-h-screen w-full flex-col gap-2 p-4 outline-none sm:max-w-sm" />
    </ToastPrimitive.Provider>
  );
}
