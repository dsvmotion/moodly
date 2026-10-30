import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

// Las rutas en español anteriores al ADR 0041 redirigen a las de ahora
// (legacy-routes.ts): marcadores y enlaces de invitación ya compartidos.
test("un enlace de invitación viejo conserva el token, también sin sesión", async ({ request, page }) => {
  const response = await request.get("/app/invitacion?token=abc_123", { maxRedirects: 0 });
  expect(response.status()).toBe(307);
  expect(response.headers()["location"]).toBe("/app/invitation?token=abc_123");

  await page.goto("/app/invitacion?token=abc_123");
  await expect(page).toHaveURL(/\/login\?next=%2Fapp%2Finvitation%3Ftoken%3Dabc_123$/);
});

test("las secciones y los ajustes viejos llevan a los nuevos", async ({ page }) => {
  await signIn(page, "a_org_admin");
  for (const [legacy, current] of [
    ["/app/ajustes", "/app/settings/general"],
    ["/app/ajustes/sedes", "/app/settings/locations"],
    ["/app/ajustes/general", "/app/settings/general"],
    ["/app/ajustes/auditoria", "/app/settings/audit"],
    ["/app/conversaciones", "/app/inbox"],
    ["/app/agentes/reception", "/app/agents/reception"],
  ] as const) {
    await page.goto(legacy);
    await expect(page).toHaveURL(new RegExp(`${current.replaceAll("/", "\\/")}$`));
  }
  // Una ruta inventada sigue sin existir aunque empiece como una vieja.
  const response = await page.goto("/app/ajustes/api");
  expect(response?.status()).toBe(404);
});
