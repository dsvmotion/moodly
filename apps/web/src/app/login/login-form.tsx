"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { signIn, type SignInState } from "./actions";

const initialState: SignInState = { error: null };

export function LoginForm({ next }: { next: string }) {
  const t = useTranslations("login");
  const [state, formAction, pending] = useActionState(signIn, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        {t("email")}
        <Input type="email" name="email" autoComplete="username" required className="h-10 font-normal" />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        {t("password")}
        <Input type="password" name="password" autoComplete="current-password" required className="h-10 font-normal" />
      </label>
      {/* Mismo mensaje para email inexistente y contraseña incorrecta: no revela si la cuenta existe. */}
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
