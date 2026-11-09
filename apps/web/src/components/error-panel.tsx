"use client";

import { startTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@repo/ui/components/button";
import { ErrorState } from "@repo/ui/components/error-state";
import { TriangleAlertIcon } from "@repo/ui/lib/icons";

/**
 * Lo que ve la persona cuando una pantalla falla (revisión del diseño §4): qué
 * pasó, reintentar y la referencia del error. El detalle nunca sale aquí: lo
 * registra el servidor (`request.error`, ADR 0032) con esa misma referencia
 * (el *digest* de Next.js), que es lo que la persona puede dar a soporte.
 */
export function ErrorPanel({ digest, reset }: { digest?: string | undefined; reset: () => void }) {
  const t = useTranslations("states.error");
  const router = useRouter();
  // Reintentar vuelve a pedir al servidor la parte que falló, no solo la del navegador.
  const retry = () =>
    startTransition(() => {
      router.refresh();
      reset();
    });

  return (
    <div className="flex flex-col gap-2">
      <ErrorState
        data-testid="error-state"
        icon={<TriangleAlertIcon />}
        title={t("heading")}
        description={t("description")}
        action={
          <Button variant="outline" onClick={retry} data-testid="error-retry">
            {t("retry")}
          </Button>
        }
      />
      {digest ? (
        <p className="text-muted-foreground text-center text-xs" data-testid="error-reference">
          {t("reference", { digest })}
        </p>
      ) : null}
    </div>
  );
}
