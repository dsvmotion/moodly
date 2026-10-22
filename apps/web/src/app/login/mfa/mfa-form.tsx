"use client";

import { useActionState } from "react";
import { verifyMfa, type MfaState } from "./actions";

const initialState: MfaState = { error: null };

export function MfaForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState(verifyMfa, initialState);

  return (
    <form action={formAction}>
      <input type="hidden" name="next" value={next} />
      <p>
        <label>
          Código de verificación{" "}
          <input
            type="text"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            autoFocus
          />
        </label>
      </p>
      {state.error ? <p role="alert">{state.error}</p> : null}
      <button type="submit" disabled={pending}>
        Verificar
      </button>
    </form>
  );
}
