import { expect, test } from "@playwright/test";
import { credentialsFor, signIn } from "./helpers";

test("sin sesión, las rutas privadas llevan al login y, tras entrar, al destino pedido", async ({ page }) => {
  await page.goto("/app/settings/organization");
  await expect(page).toHaveURL(/\/login\?next=%2Fapp%2Fsettings%2Forganization$/);

  const { email, password } = credentialsFor("a_staff");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/app\/settings\/organization$/);
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

test("cerrar sesión devuelve al login y vuelve a proteger /app", async ({ page }) => {
  await signIn(page, "a_location_manager");
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page).toHaveURL(/\/login$/);

  await page.goto("/app/settings/organization");
  await expect(page).toHaveURL(/\/login\?next=/);
});

test("el parámetro next no permite redirigir fuera de la app", async ({ page }) => {
  await signIn(page, "a_org_admin", "//evil.test/robar");
  await expect(page).toHaveURL(/^http:\/\/127\.0\.0\.1:3000\/app\/settings\/organization$/);
});

test("con sesión, /login redirige a la app", async ({ page }) => {
  await signIn(page, "b_org_admin");
  await page.goto("/login");
  await expect(page).toHaveURL(/\/app\/settings\/organization$/);
});
