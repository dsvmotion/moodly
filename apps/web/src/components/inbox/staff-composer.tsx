"use client";

import { useActionState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@repo/ui/components/button";
import { sendStaffMessage, type InboxActionState } from "@/app/app/inbox/actions";
import { MESSAGE_MAX_LENGTH } from "@/lib/inbox";

const initial: InboxActionState = { error: null, doneAt: null };

/**
 * Escribir al cliente como equipo, con la conversación en manos de una
 * persona. Quién escribe, en qué sentido y su estado los pone la base de datos
 * (guard_staff_message); el chat web lo lee de la fila y el resto de canales
 * lo envía el worker.
 */
export function StaffComposer({ id, contactName }: { id: string; contactName: string }) {
  const t = useTranslations("inboxPage");
  const [state, action, pending] = useActionState(sendStaffMessage, initial);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.doneAt) form.current?.reset();
  }, [state.doneAt]);

  return (
    <form ref={form} action={action} className="flex flex-col gap-2 border-t pt-3" data-testid="inbox-composer">
      <input type="hidden" name="id" value={id} />
      <label htmlFor="inbox-composer-content" className="sr-only">
        {t("composerLabel", { name: contactName })}
      </label>
      <textarea
        id="inbox-composer-content"
        name="content"
        required
        rows={3}
        maxLength={MESSAGE_MAX_LENGTH}
        placeholder={t("composerPlaceholder", { name: contactName })}
        disabled={pending}
        className="border-input bg-background placeholder:text-muted-foreground w-full resize-y rounded-md border px-3 py-2 text-sm disabled:opacity-50"
        data-testid="inbox-composer-input"
      />
      <div className="flex items-center justify-between gap-2">
        {state.error ? (
          <p role="alert" className="text-destructive text-sm" data-testid="inbox-composer-error">
            {t(`errors.${state.error}`)}
          </p>
        ) : (
          <span />
        )}
        <Button type="submit" size="sm" disabled={pending} data-testid="inbox-composer-send">
          {t("send")}
        </Button>
      </div>
    </form>
  );
}
