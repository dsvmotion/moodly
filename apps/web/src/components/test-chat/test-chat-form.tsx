"use client";

import { useActionState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { restartTestChat, sendTestMessage, type TestChatState } from "@/app/app/agents/[type]/test-chat-actions";

const initial: TestChatState = { error: null, sentAt: null };

/** Escribir al agente como si fuera un cliente. Lo que se puede, lo dice la base de datos. */
export function TestChatForm({ agentId, locationId, disabled }: { agentId: string; locationId: string; disabled: boolean }) {
  const t = useTranslations("testChat");
  const [state, action, pending] = useActionState(sendTestMessage, initial);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.sentAt) form.current?.reset();
  }, [state.sentAt]);

  return (
    <form ref={form} action={action} className="flex flex-col gap-2" data-testid="test-chat-form">
      <input type="hidden" name="agentId" value={agentId} />
      <input type="hidden" name="locationId" value={locationId} />
      <div className="flex gap-2">
        <Input
          name="content"
          required
          maxLength={2000}
          autoComplete="off"
          aria-label={t("inputLabel")}
          placeholder={t("placeholder")}
          disabled={disabled || pending}
          data-testid="test-chat-input"
        />
        <Button type="submit" disabled={disabled || pending} data-testid="test-chat-send">
          {t("send")}
        </Button>
      </div>
      {state.error ? (
        <p role="alert" className="text-destructive text-sm" data-testid="test-chat-error">
          {t(`errors.${state.error}`)}
        </p>
      ) : null}
    </form>
  );
}

/** Empezar de nuevo: cierra la conversación de prueba; la siguiente, sin historial. */
export function TestChatRestart({ conversationId }: { conversationId: string }) {
  const t = useTranslations("testChat");
  const [state, action, pending] = useActionState(restartTestChat, initial);
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="conversationId" value={conversationId} />
      <Button type="submit" variant="outline" size="sm" disabled={pending} data-testid="test-chat-restart">
        {t("restart")}
      </Button>
      {state.error ? (
        <p role="alert" className="text-destructive text-sm">
          {t(`errors.${state.error}`)}
        </p>
      ) : null}
    </form>
  );
}
