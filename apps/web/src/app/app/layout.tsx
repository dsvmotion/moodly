import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { LOGIN_PATH } from "@/lib/auth/routes";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";

// Segunda comprobación de sesión además del proxy: si el proxy no se
// ejecutara (p. ej. un matcher mal configurado), /app sigue exigiendo sesión.
export default async function AppLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect(LOGIN_PATH);

  return (
    <>
      <header>
        <span data-testid="current-user">{data.claims.email}</span>{" "}
        <form action={signOut} style={{ display: "inline" }}>
          <button type="submit">Cerrar sesión</button>
        </form>
      </header>
      {children}
    </>
  );
}
