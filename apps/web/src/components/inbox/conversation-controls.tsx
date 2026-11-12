"use client";

import { startTransition, useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@repo/ui/components/button";
import { ConfirmDialog } from "@repo/ui/components/confirm-dialog";
import { setConversationMode, type InboxActionState } from "@/app/app/inbox/actions";
import type { ConversationMode } from "@/lib/inbox";

const initial: InboxActionState = { error: null, doneAt: null };

/**
 * Quién lleva la conversación: tomar el control (con confirmación: el agente
 * deja de responder) o devolverla al agente. Si se puede, lo dice la base de
 * datos (RLS y guard_conversation_mode); una cerrada no tiene controles.
 */
export function ConversationControls({ id, mode, contactName }: { id: string; mode: ConversationMode; contactName: string }) {
  const t = useTranslations("inboxPage");
  const [state, action, pending] = useActionState(setConversationMode, initial);

  if (mode === "closed") return null;

  const submit = (next: "agent" | "human") => {
    const data = new FormData();
    data.set("id", id);
    data.set("mode", next);
    startTransition(() => action(data));
  };

  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      {mode === "agent" ? (
        // Con su propio disparador: Radix abre, cierra y devuelve el foco al botón.
        <ConfirmDialog
          trigger={
            <Button size="sm" disabled={pending} data-testid="inbox-take-over">
              {t("takeOver")}
            </Button>
          }
          title={t("takeOverTitle")}
          description={t("takeOverDescription", { name: contactName })}
          confirmLabel={t("takeOverConfirm")}
          cancelLabel={t("cancel")}
          onConfirm={() => submit("human")}
        />
      ) : (
        <Button size="sm" variant="outline" disabled={pending} onClick={() => submit("agent")} data-testid="inbox-give-back">
          {t("giveBack")}
        </Button>
      )}
      {state.error ? (
        <p role="alert" className="text-destructive text-sm" data-testid="inbox-action-error">
          {t(`errors.${state.error}`)}
        </p>
      ) : null}
    </div>
  );
}
