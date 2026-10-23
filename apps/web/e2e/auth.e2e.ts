import { expect, test } from "@playwright/test";
import { credentialsFor, signIn } from "./helpers";

test("sin sesión, las rutas privadas llevan al login y, tras entrar, al destino pedido", async ({ page }) => {
  await page.goto("/app/ajustes/general");
  await expect(page).toHaveURL(/\/login\?next=%2Fapp%2Fajustes%2Fgeneral$/);

  const { email, password } = credentialsFor("a_staff");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/app\/ajustes\/general$/);
});

test("contraseña incorrecta: error genérico y sin sesión", async ({ page }) => {
  const { email } = credentialsFor("a_org_admin");
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Contraseña").fill("contraseña-incorrecta");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("Email o contraseña incorrectos.");

  await page.goto("/app");
  await expect(page).toHaveURL(/\/login/);
});

// Destinos maliciosos para el parámetro de vuelta. Los que llevan tabulador o
// salto de línea explotan que el navegador los elimina de las URL: "/\t/x"
// pasa un filtro ingenuo de "empieza por / y no por //" y acaba como "//x".
const externalNextValues = [
  "//evil.test/robar",
  "https://evil.test/robar",
  "/\\evil.test/robar",
  "/\t/evil.test/robar",
  "/\n/evil.test/robar",
  "/\r/evil.test/robar",
  "javascript:alert(1)",
];

for (const next of externalNextValues) {
  test(`next=${JSON.stringify(next)} no redirige fuera de la app`, async ({ page }) => {
    await signIn(page, "a_org_admin", next);
    await expect(page).toHaveURL(/^http:\/\/127\.0\.0\.1:3000\/app\/ajustes\/general$/);
  });
}

test("con sesión, /login redirige a la app", async ({ page }) => {
  await signIn(page, "b_org_admin");
  await page.goto("/login");
  await expect(page).toHaveURL(/\/app\/ajustes\/general$/);
});
