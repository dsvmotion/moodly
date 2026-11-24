"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, useTransition } from "react";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import type { IntegrationStatus } from "@/lib/integrations/status";
import { disconnectKeyIntegration, keySubmissionStatus, submitIntegrationKey } from "./key-actions";

type Notice =
  | "invalid"
  | "invalid_key"
  | "not_allowed"
  | "unavailable"
  | "too_many"
  | "checking"
  | "applied"
  | "rejected"
  | "rejected_kept"
  | "still_checking";

const POLL_MS = 1500;
const POLL_LIMIT_MS = 60_000;

// Una integración con clave del cliente (ADR 0055). La persona pega la clave;
// el servidor la cifra hacia el worker y el worker la comprueba con el
// proveedor. Mientras, la tarjeta pregunta cada poco qué pasó con ese envío. La
// clave no se guarda en el estado de React: se lee del campo al enviar y el
// formulario se vacía enseguida.
export function KeyIntegrationCard({
  provider,
  status,
  lastRejected,
  canAdminister,
}: {
  provider: string;
  /** null: quien mira no es org_admin y no ve el estado. */
  status: IntegrationStatus | null;
  /** El último envío no valía y sigue la clave anterior (activa). */
  lastRejected: boolean;
  canAdminister: boolean;
}) {
  const t = useTranslations("integrationsPage");
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<Notice | null>(lastRejected ? "rejected_kept" : null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  function poll(submissionId: string, wasActive: boolean, startedAt: number) {
    timer.current = setTimeout(async () => {
      const result = await keySubmissionStatus(provider, submissionId);
      if (result === "applied" || result === "rejected") {
        setNotice(result === "applied" ? "applied" : wasActive ? "rejected_kept" : "rejected");
        router.refresh();
        return;
      }
      if (Date.now() - startedAt > POLL_LIMIT_MS) {
        setNotice("still_checking");
        router.refresh();
        return;
      }
      poll(submissionId, wasActive, startedAt);
    }, POLL_MS);
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const field = event.currentTarget.elements.namedItem("api_key");
    const value = field instanceof HTMLInputElement ? field.value : "";
    form.current?.reset();
    if (timer.current) clearTimeout(timer.current);
    const wasActive = status === "active";
    startTransition(async () => {
      const result = await submitIntegrationKey(provider, value);
      if (!result.ok) {
        setNotice(result.error);
        return;
      }
      setNotice("checking");
      router.refresh();
      poll(result.submissionId, wasActive, Date.now());
    });
  }

  function remove() {
    if (timer.current) clearTimeout(timer.current);
    setNotice(null);
    startTransition(async () => {
      const result = await disconnectKeyIntegration(provider);
      if (!result.ok) setNotice(result.error);
      router.refresh();
    });
  }

  const connected = status === "active";
  const canRemove = status === "active" || status === "pending" || status === "error";
  const isError = notice !== null && notice !== "checking" && notice !== "applied" && notice !== "still_checking";

  return (
    <li className="flex flex-col gap-3 p-4" data-testid={`integration-${provider}`}>
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-medium">{t(`providers.${provider}.name`)}</h2>
          {status ? (
            <Badge variant={connected ? "default" : status === "error" ? "outline" : "muted"} data-testid="integration-status">
              {t(`status.${status}`)}
            </Badge>
          ) : null}
        </div>
        <p className="text-muted-foreground text-sm">{t(`providers.${provider}.description`)}</p>
        {notice ? (
          <p
            role={isError ? "alert" : "status"}
            aria-live="polite"
            className={isError ? "text-destructive text-sm" : "text-muted-foreground text-sm"}
            data-testid="integration-key-notice"
          >
            {t(`keyNotices.${notice}`)}
          </p>
        ) : null}
      </div>
      {canAdminister ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <form ref={form} onSubmit={submit} className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-end" autoComplete="off">
            <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
              {t("apiKeyLabel")}
              <Input
                name="api_key"
                type="password"
                autoComplete="new-password"
                spellCheck={false}
                required
                minLength={8}
                maxLength={512}
                disabled={pending || notice === "checking"}
                data-testid="integration-key-input"
              />
            </label>
            <Button type="submit" disabled={pending || notice === "checking"} data-testid="integration-key-submit">
              {connected ? t("changeKey") : t("saveKey")}
            </Button>
          </form>
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
