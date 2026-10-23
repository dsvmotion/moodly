"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { disableMfa, type DisableState } from "@/app/app/mfa-actions";

const initialState: DisableState = { error: null };

// Baja del segundo factor: pide el código que muestra ahora la aplicación
// (auditoría R-21), no basta con la sesión.
export function MfaDisable() {
  const t = useTranslations("security");
  const [state, action, pending] = useActionState(disableMfa, initialState);

  return (
    <form action={action} className="flex flex-col gap-3">
      <p className="text-sm">{t("disableHelp")}</p>
      <label className="flex flex-col gap-1 text-sm">
        {t("currentCode")}
        <input
          type="text"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          required
          className="w-32 rounded-md border px-2 py-1.5"
        />
      </label>
      {state.error ? <p role="alert">{state.error}</p> : null}
      <button type="submit" disabled={pending} className="self-start rounded-md border px-3 py-1.5">
        {t("disable")}
      </button>
    </form>
  );
}
