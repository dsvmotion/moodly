import { expect, test, type APIRequestContext } from "@playwright/test";
import { credentialsFor } from "./helpers";

// Tarea 3c-1: tras cerrar sesión, el access token sigue siendo un JWT con firma
// válida hasta que caduca. Antes de la revocación en RLS, un token copiado
// antes del logout seguía leyendo datos por la API REST de Supabase; ahora las
// políticas exigen que su session_id siga vivo en auth.sessions.

function supabasePublicEnv(): { url: string; publishableKey: string } {
  const url = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const publishableKey = process.env["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !publishableKey) throw new Error("Falta apps/web/.env.local: pnpm --filter @repo/web env:local");
  return { url, publishableKey };
}

async function signInApi(request: APIRequestContext, key: string): Promise<string> {
  const { url, publishableKey } = supabasePublicEnv();
  const { email, password } = credentialsFor(key);
  const response = await request.post(`${url}/auth/v1/token?grant_type=password`, {
    headers: { apikey: publishableKey },
    data: { email, password },
  });
  expect(response.status()).toBe(200);
  return (await response.json()).access_token as string;
}

async function restRows(request: APIRequestContext, token: string, path: string): Promise<unknown[]> {
  const { url, publishableKey } = supabasePublicEnv();
  const response = await request.get(`${url}/rest/v1/${path}`, {
    headers: { apikey: publishableKey, Authorization: `Bearer ${token}` },
  });
  expect(response.status()).toBe(200);
  return (await response.json()) as unknown[];
}

test("un token copiado antes del logout ya no lee datos por la API REST", async ({ request }) => {
  const { url, publishableKey } = supabasePublicEnv();
  const stolenToken = await signInApi(request, "a_org_admin");

  expect(await restRows(request, stolenToken, "locations?select=name")).toHaveLength(3);

  const logout = await request.post(`${url}/auth/v1/logout?scope=local`, {
    headers: { apikey: publishableKey, Authorization: `Bearer ${stolenToken}` },
  });
  expect(logout.status()).toBe(204);

  // El JWT sigue siendo válido (PostgREST responde 200), pero RLS ya no da filas.
  for (const table of ["organizations", "regions", "locations", "users", "memberships"]) {
    expect(await restRows(request, stolenToken, `${table}?select=id`), table).toEqual([]);
  }
});

test("cerrar una sesión no afecta a otra sesión activa del mismo usuario", async ({ request }) => {
  const { url, publishableKey } = supabasePublicEnv();
  const laptop = await signInApi(request, "a_location_manager");
  const phone = await signInApi(request, "a_location_manager");

  const logout = await request.post(`${url}/auth/v1/logout?scope=local`, {
    headers: { apikey: publishableKey, Authorization: `Bearer ${laptop}` },
  });
  expect(logout.status()).toBe(204);

  expect(await restRows(request, laptop, "locations?select=name")).toEqual([]);
  expect(await restRows(request, phone, "locations?select=name")).toEqual([{ name: "A1 Norte" }]);
});
