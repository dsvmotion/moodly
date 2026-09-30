"use server";

import { redirect } from "next/navigation";
import { LOGIN_PATH } from "@/lib/auth/routes";
import { createClient } from "@/lib/supabase/server";

// scope "local": cierra esta sesión (la revoca en el servidor de Auth y borra
// las cookies), como recomienda supabase-js para un botón de "Cerrar sesión";
// "global" cerraría también las de otros dispositivos.
export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect(LOGIN_PATH);
}
