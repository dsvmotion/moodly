// Variables públicas de Supabase. Solo URL y clave publicable: la clave
// secreta / service role no existe en apps/web (lo comprueba un test).
export function supabasePublicEnv(): { url: string; publishableKey: string } {
  const url = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const publishableKey = process.env["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !publishableKey) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. En local: pnpm --filter @repo/web env:local",
    );
  }
  return { url, publishableKey };
}
