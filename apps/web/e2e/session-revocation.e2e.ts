import { expect, test } from "@playwright/test";
import { apiToken, restRows, supabasePublicEnv } from "./helpers";

// Tarea 3c-1: tras cerrar sesión, el access token sigue siendo un JWT con firma
// válida hasta que caduca. Antes de la revocación en RLS, un token copiado
// antes del logout seguía leyendo datos por la API REST de Supabase; ahora las
// políticas exigen que su session_id siga vivo en auth.sessions.

test("un token copiado antes del logout ya no lee datos por la API REST", async ({ request }) => {
  const { url, publishableKey } = supabasePublicEnv();
  // a_org_admin tiene MFA: su token completo (aal2), como el de la app.
  const stolenToken = await apiToken(request, "a_org_admin");

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
  const laptop = await apiToken(request, "a_location_manager");
  const phone = await apiToken(request, "a_location_manager");

  const logout = await request.post(`${url}/auth/v1/logout?scope=local`, {
    headers: { apikey: publishableKey, Authorization: `Bearer ${laptop}` },
  });
  expect(logout.status()).toBe(204);

  expect(await restRows(request, laptop, "locations?select=name")).toEqual([]);
  expect(await restRows(request, phone, "locations?select=name")).toEqual([{ name: "A1 Norte" }]);
});
