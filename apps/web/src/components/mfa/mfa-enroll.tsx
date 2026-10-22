"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { confirmEnrollment, startEnrollment, type ConfirmState, type EnrollState } from "@/app/app/mfa-actions";

const initialEnroll: EnrollState = { error: null, factorId: null, qrCode: null, secret: null };
const initialConfirm: ConfirmState = { error: null };

// Alta del segundo factor: 1) se pide un factor nuevo y se enseña su QR (y el
// secreto para escribirlo a mano); 2) la persona escribe el primer código.
export function MfaEnroll() {
  const t = useTranslations("security");
  const [started, start, starting] = useActionState(startEnrollment, initialEnroll);
  const [confirmed, confirm, confirming] = useActionState(confirmEnrollment, initialConfirm);

  if (!started.factorId) {
    return (
      <form action={start} className="flex flex-col gap-2">
        {started.error ? <p role="alert">{started.error}</p> : null}
        <button type="submit" disabled={starting} className="self-start rounded-md border px-3 py-1.5">
          {t("enable")}
        </button>
      </form>
    );
  }

  return (
    <form action={confirm} className="flex flex-col gap-3">
      <input type="hidden" name="factorId" value={started.factorId} />
      <p>{t("scan")}</p>
      {started.qrCode ? (
        // QR en SVG que genera Supabase Auth (data URL): next/image no aporta nada aquí.
        <img src={started.qrCode} alt={t("qrAlt")} width={180} height={180} className="rounded-md border bg-white p-2" />
      ) : null}
      <p className="text-sm">
        {t("manual")} <code data-testid="mfa-secret">{started.secret}</code>
      </p>
      <label className="flex flex-col gap-1 text-sm">
        {t("code")}
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
      {confirmed.error ? <p role="alert">{confirmed.error}</p> : null}
      <button type="submit" disabled={confirming} className="self-start rounded-md border px-3 py-1.5">
        {t("verify")}
      </button>
    </form>
  );
}
