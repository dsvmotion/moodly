"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, useTransition } from "react";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { keyCheckState } from "@/lib/integrations/key-check";
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
  | "still_checking"
  | "timed_out";

// El primer minuto se pregunta a menudo; después, cada poco, hasta la caducidad.
const POLL_MS = 1500;
const SLOW_POLL_MS = 15_000;
const FAST_FOR_MS = 60_000;

/**
 * El envío en curso, en sessionStorage: si la persona recarga, la tarjeta sigue
 * esperándolo (y dice «no se pudo comprobar a tiempo» si caducó). Solo el id del
 * envío y la hora: nunca la clave. Si el navegador no deja, sin más.
 */
interface PendingSubmission {
  submissionId: string;
  sentAt: number;
  wasActive: boolean;
}
const storageKey = (provider: string) => `key-submission:${provider}`;
function readPending(provider: string): PendingSubmission | null {
  try {
    const raw = window.sessionStorage.getItem(storageKey(provider));
    const parsed = raw ? (JSON.parse(raw) as Partial<PendingSubmission>) : null;
    return parsed && typeof parsed.submissionId === "string" && typeof parsed.sentAt === "number"
      ? { submissionId: parsed.submissionId, sentAt: parsed.sentAt, wasActive: parsed.wasActive === true }
      : null;
  } catch {
    return null;
  }
}
function writePending(provider: string, pending: PendingSubmission | null): void {
  try {
    if (pending) window.sessionStorage.setItem(storageKey(provider), JSON.stringify(pending));
    else window.sessionStorage.removeItem(storageKey(provider));
  } catch {
    // Sin almacenamiento: al recargar no se retoma, y no pasa nada más.
  }
}

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

  function poll(pending: PendingSubmission, delayMs?: number) {
    const fast = Date.now() - pending.sentAt < FAST_FOR_MS;
    timer.current = setTimeout(
      async () => {
        const result = await keySubmissionStatus(provider, pending.submissionId);
        if (result === null) return;
        const state = keyCheckState(result, pending.sentAt, Date.now());
        if (state === "applied" || state === "rejected") {
          writePending(provider, null);
          setNotice(state === "applied" ? "applied" : pending.wasActive ? "rejected_kept" : "rejected");
          router.refresh();
          return;
        }
        if (state === "timed_out") {
          writePending(provider, null);
          setNotice("timed_out");
          router.refresh();
          return;
        }
        setNotice(fast ? "checking" : "still_checking");
        poll(pending);
      },
      delayMs ?? (fast ? POLL_MS : SLOW_POLL_MS),
    );
  }

  // Al montar: si había un envío en curso (recarga), se retoma.
  useEffect(() => {
    const pending = readPending(provider);
    // La primera pregunta, enseguida: su respuesta pone el aviso.
    if (pending) poll(pending, 0);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // Solo al montar: poll cierra sobre lo que necesita.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      const pending = { submissionId: result.submissionId, sentAt: Date.now(), wasActive };
      writePending(provider, pending);
      setNotice("checking");
      router.refresh();
      poll(pending);
    });
  }

  function remove() {
    if (timer.current) clearTimeout(timer.current);
    writePending(provider, null);
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
