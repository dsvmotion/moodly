import { expect, test } from "@playwright/test";
import { totp } from "../../../packages/db/src/seed/totp";
import { completeMfa, credentialsFor, signIn, withMfaLock } from "./helpers";

// MFA obligatorio para administrar (migración admin_mfa): quien tiene un
// segundo factor no entra sin el código, y un org_admin solo puede hacer
// cambios con él. Lo que exige la base de datos lo cubre 13_admin_mfa (pgTAP).

/** Un código de 6 cifras que no es el actual. */
const wrongCode = (secret: string) => String((Number(totp(secret)) + 500_000) % 1_000_000).padStart(6, "0");
const formError = (page: import("@playwright/test").Page) => page.locator('form p[role="alert"]');

test("org_admin: tras la contraseña pide el código; sin él no entra y con él sí", async ({ page }) => {
  const { email, password, totpSecret } = credentialsFor("a_org_admin");
  if (!totpSecret) throw new Error("El seed no ha dado de alta el TOTP de a_org_admin: ejecuta pnpm db:seed");

  // Mientras la sesión es aal1, otro test que verifique el código de a_org_admin la cerraría.
  await withMfaLock("a_org_admin", async () => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Contraseña").fill(password);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/login\/mfa/);

    // Saltarse el paso no sirve: con la sesión de la contraseña sola (aal1), la
    // app vuelve a pedir el código.
    await page.goto("/app/settings/organization");
    await expect(page).toHaveURL(/\/login\/mfa$/);
    await expect(page.getByTestId("organization")).toHaveCount(0);

    await page.getByLabel("Código de verificación").fill(wrongCode(totpSecret));
    await page.getByRole("button", { name: "Verificar" }).click();
    await expect(formError(page)).toHaveText("El código no es correcto. Prueba con el que muestra ahora tu aplicación.");

    await completeMfa(page, totpSecret);
    await expect(page.getByTestId("current-user")).toHaveText(email);
  });

  // Con aal2 puede administrar: sin aviso y con el formulario de invitación.
  await page.goto("/app/settings/organization");
  await expect(page.getByTestId("mfa-required")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Crear invitación" })).toBeVisible();
});

test("activar la verificación en dos pasos, entrar con ella y desactivarla", async ({ page }) => {
  const { email, password } = credentialsFor("guest_mfa");
  await signIn(page, "guest_mfa");
  await page.goto("/app/settings/security");
  await expect(page.getByTestId("mfa-status")).toHaveText("Desactivada.");

  await page.getByRole("button", { name: "Activar la verificación en dos pasos" }).click();
  await expect(page.getByRole("img", { name: "Código QR para la aplicación de autenticación" })).toBeVisible();
  const secret = (await page.getByTestId("mfa-secret").innerText()).trim();

  await page.getByLabel("Código de 6 cifras").fill(wrongCode(secret));
  await page.getByRole("button", { name: "Verificar y activar" }).click();
  await expect(formError(page)).toHaveText("El código no es correcto. Prueba con el que muestra ahora la aplicación.");

  await page.getByLabel("Código de 6 cifras").fill(totp(secret));
  await page.getByRole("button", { name: "Verificar y activar" }).click();
  await expect(page.getByTestId("mfa-status")).toHaveText(/^Activada/);

  // Sale y vuelve a entrar: ahora la contraseña sola no basta.
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await completeMfa(page, secret);
  await expect(page.getByTestId("current-user")).toHaveText(email);

  // Desactivarla (Auth exige aal2 para quitar un factor verificado).
  await page.goto("/app/settings/security");
  await page.getByRole("button", { name: "Desactivar la verificación en dos pasos" }).click();
  await expect(page.getByTestId("mfa-status")).toHaveText("Desactivada.");
});
