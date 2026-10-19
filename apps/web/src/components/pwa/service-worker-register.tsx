"use client";

import { Button } from "@repo/ui/components/button";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { registerServiceWorker } from "../../lib/pwa/register";

type UpdateBannerProps = {
  labels: { message: string; reload: string; later: string };
  onReload: () => void;
  onLater: () => void;
};

/** Aviso discreto de versión nueva: recargar ahora o dejarlo para más tarde. */
export function UpdateBanner({ labels, onReload, onLater }: UpdateBannerProps) {
  return (
    <div className="fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-[100] flex items-center justify-between gap-3 rounded-lg border bg-surface p-4 text-sm text-surface-foreground shadow-panel sm:left-auto sm:max-w-sm">
      <span>{labels.message}</span>
      <div className="flex shrink-0 gap-2">
        <Button size="sm" variant="ghost" onClick={onLater}>
          {labels.later}
        </Button>
        <Button size="sm" onClick={onReload}>
          {labels.reload}
        </Button>
      </div>
    </div>
  );
}

/**
 * Registra el service worker de la PWA (solo en producción, para no interferir
 * con el dev de Next) y, cuando hay una versión nueva esperando, muestra un
 * aviso para recargar. La versión nueva no se activa hasta que el usuario lo
 * acepta. La región aria-live existe siempre para que el aviso se anuncie.
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

  return (
    <div aria-live="polite">
      {apply ? (
        <UpdateBanner
          labels={{ message: t("updateAvailable"), reload: t("reload"), later: t("later") }}
          onReload={apply}
          onLater={() => setApply(null)}
        />
      ) : null}
    </div>
  );
}
