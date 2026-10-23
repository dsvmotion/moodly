import { expect, test } from "@playwright/test";
import { passwordToken, restRows, verifyTotpApi, withMfaLock } from "./helpers";

// Auditoría 2026-10-23, R-16 (migración mfa_reads): con el segundo factor
// activado, la contraseña sola (sesión aal1) no lee nada por la API REST de
// Supabase; con el código (aal2), lo de siempre. Antes leía todo lo de sus
// organizaciones sin el código.

test("con MFA, la contraseña sola no lee datos por la API REST; con el código, sí", async ({ request }) => {
  // Mientras la sesión es aal1, otro test que verifique el código de a_org_admin
  // la cerraría y el test pasaría por el motivo equivocado: todo, bajo el bloqueo.
  await withMfaLock("a_org_admin", async () => {
    const { token, factorId } = await passwordToken(request, "a_org_admin");
    expect(factorId, "a_org_admin tiene TOTP en el seed").not.toBeNull();

    for (const table of ["organizations", "regions", "locations", "users", "memberships", "invitations"]) {
      expect(await restRows(request, token, `${table}?select=id`), table).toEqual([]);
    }

    const fullToken = await verifyTotpApi(request, "a_org_admin", token, factorId ?? "");
    expect(await restRows(request, fullToken, "locations?select=id")).toHaveLength(3);
    expect(await restRows(request, fullToken, "organizations?select=id")).toHaveLength(1);
  });
});

test("sin MFA, la contraseña sola sigue leyendo lo suyo", async ({ request }) => {
  const { token, factorId } = await passwordToken(request, "a_location_manager");
  expect(factorId).toBeNull();
  expect(await restRows(request, token, "locations?select=name")).toEqual([{ name: "A1 Norte" }]);
});
