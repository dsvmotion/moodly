"use server";

import { redirect } from "next/navigation";
import { safeNextPath } from "@/lib/auth/routes";
import { createClient } from "@/lib/supabase/server";

export interface SignInState {
  error: string | null;
}

export async function signIn(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const email = formData.get("email");
  const password = formData.get("password");
  if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
    return { error: "Introduce email y contraseña." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  // Mensaje genérico: no revela si el email existe.
  if (error) return { error: "Email o contraseña incorrectos." };

  redirect(safeNextPath(formData.get("next")));
}
