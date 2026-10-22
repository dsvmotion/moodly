import { redirect } from "next/navigation";
import { signOut } from "@/app/app/actions";
import { LOGIN_PATH, safeNextPath } from "@/lib/auth/routes";
import { getCurrentUser, getSessionAal, hasVerifiedFactor } from "@/lib/auth/session";
import { MfaForm } from "./mfa-form";

// Segundo paso del login para quien tiene MFA activado. Exige la sesión de la
// contraseña (aal1); con aal2 o sin factor no hay nada que hacer aquí.
export default async function MfaPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNextPath((await searchParams).next);
  const user = await getCurrentUser();
  if (!user) redirect(LOGIN_PATH);
  if (!hasVerifiedFactor(user) || (await getSessionAal()) === "aal2") redirect(next);

  return (
    <main>
      <h1>Verificación en dos pasos</h1>
      <p>Abre tu aplicación de autenticación y escribe el código de 6 cifras para {user.email}.</p>
      <MfaForm next={next} />
      <form action={signOut}>
        <button type="submit">Salir</button>
      </form>
    </main>
  );
}
