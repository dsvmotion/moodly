"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { acceptInvitation, type AcceptState } from "@/app/app/invitations-actions";

const initialState: AcceptState = { error: null };

// Aceptar es un POST explícito: abrir el enlace (o que alguien lo precargue)
// nunca acepta la invitación por sí solo.
export function AcceptForm({ token }: { token: string }) {
  const t = useTranslations("invitations.accept");
  const [state, formAction, pending] = useActionState(acceptInvitation, initialState);
  return (
    <form action={formAction} className="flex flex-col items-start gap-3">
      <input type="hidden" name="token" value={token} />
      {state.error ? <p role="alert" className="text-sm">{state.error}</p> : null}
      <button type="submit" disabled={pending} className="rounded-md border px-3 py-1.5 text-sm font-medium">
        {t("button")}
      </button>
    </form>
  );
}
