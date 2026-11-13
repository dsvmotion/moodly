"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, useTransition } from "react";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import type { IntegrationStatus } from "@/lib/integrations/status";
import { disconnect, startConnect } from "./actions";


type ErrorKey = "invalid" | "not_allowed" | "unavailable" | "platform_failed";

// Una integración de la lista. «Conectar» abre la ventana de la plataforma de
// conectores (Nango) para que la persona autorice con su cuenta; al cerrarla,
// la página se vuelve a leer (el estado lo pone el worker cuando llega el
// webhook firmado). La ventana se abre al hacer clic, antes de pedir el enlace,
// para que el navegador no la bloquee.
export function IntegrationCard({
  provider,
  status,
  canAdminister,
}: {
  provider: string;
  /** null: quien mira no es org_admin y no ve el estado. */
  status: IntegrationStatus | null;
  canAdminister: boolean;
}) {
  const t = useTranslations("integrationsPage");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<ErrorKey | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const refresh = () => router.refresh();
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      if (timer.current) clearInterval(timer.current);
    };
  }, [router]);

  function connect() {
    setError(null);
    const popup = window.open("", "integration-connect", "popup,width=520,height=720");
    startTransition(async () => {
      const result = await startConnect(provider);
      if (!result.ok) {
        popup?.close();
        setError(result.error);
        return;
      }
      if (popup) {
        popup.location.href = result.connectLink;
        if (timer.current) clearInterval(timer.current);
        timer.current = setInterval(() => {
          if (popup.closed) {
            if (timer.current) clearInterval(timer.current);
            router.refresh();
          }
        }, 1000);
      } else {
        window.location.assign(result.connectLink);
      }
      router.refresh();
    });
  }

  function remove() {
    setError(null);
    startTransition(async () => {
      const result = await disconnect(provider);
      if (!result.ok) setError(result.error);
      router.refresh();
    });
  }

  const connected = status === "active";
  const canRemove = status === "active" || status === "pending" || status === "expired" || status === "error";

  return (
    <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between" data-testid={`integration-${provider}`}>
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-medium">{t(`providers.${provider}.name`)}</h2>
          {status ? (
            <Badge variant={connected ? "default" : status === "error" || status === "expired" ? "outline" : "muted"} data-testid="integration-status">
              {t(`status.${status}`)}
            </Badge>
          ) : null}
        </div>
        <p className="text-muted-foreground text-sm">{t(`providers.${provider}.description`)}</p>
        {error ? (
          <p role="alert" className="text-destructive text-sm" data-testid="integration-error">
            {t(`errors.${error}`)}
          </p>
        ) : null}
      </div>
      {canAdminister ? (
        <div className="flex shrink-0 gap-2">
          {!connected ? (
            <Button type="button" onClick={connect} disabled={pending} data-testid="integration-connect">
              {status === "none" || status === "disconnected" ? t("connect") : t("reconnect")}
            </Button>
          ) : null}
          {canRemove ? (
            <Button type="button" variant="outline" onClick={remove} disabled={pending} data-testid="integration-disconnect">
              {t("disconnect")}
            </Button>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
