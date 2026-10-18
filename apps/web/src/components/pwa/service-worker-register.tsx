"use client";

import { Button } from "@repo/ui/components/button";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { registerServiceWorker } from "@/lib/pwa/register";

/**
 * Registra el service worker de la PWA (solo en producción, para no interferir
 * con el dev de Next) y, cuando hay una versión nueva esperando, muestra un
 * aviso para recargar. La versión nueva no se activa hasta que el usuario lo
 * acepta.
 */
export function ServiceWorkerRegister() {
  const t = useTranslations("pwa");
  const [apply, setApply] = useState<(() => void) | null>(null);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    void registerServiceWorker(
      navigator.serviceWorker,
      (next) => setApply(() => next),
      () => location.reload(),
    );
  }, []);

  if (!apply) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-[100] flex items-center justify-between gap-3 rounded-lg border bg-surface p-4 text-sm text-surface-foreground shadow-panel sm:left-auto sm:max-w-sm"
    >
      <span>{t("updateAvailable")}</span>
      <Button size="sm" onClick={apply}>
        {t("reload")}
      </Button>
    </div>
  );
}
