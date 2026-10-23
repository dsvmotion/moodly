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

test("la pantalla de acceso lleva la marca y dice que se entra por invitación", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { level: 1, name: "Entrar en Moodly" })).toBeVisible();
  await expect(page.getByRole("main").getByRole("img", { name: "Moodly" })).toBeVisible();
  await expect(page.getByRole("main")).toContainText("Se entra por invitación de tu organización.");
});

test("en inglés, el acceso y sus errores están traducidos (sin revelar si la cuenta existe)", async ({ page, context }) => {
  await context.addCookies([{ name: "locale", value: "en", url: "http://127.0.0.1:3000" }]);
  await page.goto("/login");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("heading", { level: 1, name: "Sign in to Moodly" })).toBeVisible();
  await page.getByLabel("Email").fill(`no-existe-${Date.now()}@demo.test`);
  await page.getByLabel("Password").fill("not-the-password-123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("Incorrect email or password.");
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
