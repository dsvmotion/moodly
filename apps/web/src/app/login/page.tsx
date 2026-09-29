import { BRAND_NAME } from "@repo/config";
import { safeNextPath } from "@/lib/auth/routes";
import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;

  return (
    <main>
      <h1>Entrar en {BRAND_NAME}</h1>
      <LoginForm next={safeNextPath(next)} />
    </main>
  );
}
