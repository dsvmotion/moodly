import type { ReactNode } from "react";
import { requireUser } from "@/lib/auth/session";
import { signOut } from "./actions";

// El layout solo pinta la cabecera. La comprobación que protege los datos está
// en cada página (requireUser, cerca de los datos): según la guía de Next.js,
// los layouts no se vuelven a renderizar al navegar.
export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();

  return (
    <>
      <header>
        <span data-testid="current-user">{user.email}</span>{" "}
        <form action={signOut} style={{ display: "inline" }}>
          <button type="submit">Cerrar sesión</button>
        </form>
      </header>
      {children}
    </>
  );
}
