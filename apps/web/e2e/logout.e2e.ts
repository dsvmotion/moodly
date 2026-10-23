import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("cerrar sesión devuelve al login y vuelve a proteger /app", async ({ page }) => {
  await signIn(page, "a_location_manager");
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page).toHaveURL(/\/login$/);

  await page.goto("/app/ajustes/general");
  await expect(page).toHaveURL(/\/login\?next=/);
});

// Cerrar sesión debe invalidar la sesión en el servidor, no solo borrar las
// cookies del navegador: si alguien copió las cookies antes (otro dispositivo,
// un proxy, malware), reutilizarlas después del logout no debe dar acceso.
test("tras cerrar sesión, las cookies de sesión copiadas antes ya no dan acceso", async ({ page, browser }) => {
  await signIn(page, "a_org_admin");
  const stolenCookies = await page.context().cookies();

  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page).toHaveURL(/\/login$/);

  const attacker = await browser.newContext();
  await attacker.addCookies(stolenCookies);
  const attackerPage = await attacker.newPage();
  await attackerPage.goto("/app/ajustes/general");
  await expect(attackerPage).toHaveURL(/\/login/);
  await expect(attackerPage.getByTestId("organization")).toHaveCount(0);
  await attacker.close();
});
