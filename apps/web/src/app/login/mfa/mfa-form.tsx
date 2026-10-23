"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { verifyMfa, type MfaState } from "./actions";

const initialState: MfaState = { error: null };

export function MfaForm({ next }: { next: string }) {
  const t = useTranslations("mfaLogin");
  const [state, formAction, pending] = useActionState(verifyMfa, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        {t("code")}
        <Input
          type="text"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          required
          autoFocus
          className="h-11 text-center font-mono text-lg tracking-[0.4em]"
        />
      </label>
      {state.error ? (
        <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">
          {t(`errors.${state.error}`)}
        </p>
      ) : null}
      <Button type="submit" disabled={pending} className="h-10 w-full">
        {pending ? t("submitting") : t("submit")}
      </Button>
    </form>
  );
}
