import { BRAND_NAME } from "@repo/config";
import { redirect } from "next/navigation";
import { safeNextPath } from "@/lib/auth/routes";
import { getCurrentUser } from "@/lib/auth/session";
import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  // Con sesión viva, directamente al destino. Se comprueba aquí con getUser()
  // y no en el proxy con getClaims(): con cookies de una sesión ya cerrada,
  // el proxy las daría por buenas y /login ↔ /app entrarían en bucle.
  if (await getCurrentUser()) redirect(safeNextPath(next));

  return (
    <main>
      <h1>Entrar en {BRAND_NAME}</h1>
      <LoginForm next={safeNextPath(next)} />
    </main>
  );
}
