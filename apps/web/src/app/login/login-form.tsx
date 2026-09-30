"use client";

import { useActionState } from "react";
import { signIn, type SignInState } from "./actions";

const initialState: SignInState = { error: null };

export function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState(signIn, initialState);

  return (
    <form action={formAction}>
      <input type="hidden" name="next" value={next} />
      <p>
        <label>
          Email <input type="email" name="email" autoComplete="username" required />
        </label>
      </p>
      <p>
        <label>
          Contraseña <input type="password" name="password" autoComplete="current-password" required />
        </label>
      </p>
      {state.error ? <p role="alert">{state.error}</p> : null}
      <button type="submit" disabled={pending}>
        Entrar
      </button>
    </form>
  );
}
