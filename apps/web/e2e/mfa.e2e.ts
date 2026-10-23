import { expect, test } from "@playwright/test";
import { totp } from "../../../packages/db/src/seed/totp";
import { completeMfa, credentialsFor, signIn, signOutFromMenu, withMfaLock } from "./helpers";

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
    await page.goto("/app/ajustes/general");
    await expect(page).toHaveURL(/\/login\/mfa$/);
    await expect(page.getByTestId("organization")).toHaveCount(0);

    await page.getByLabel("Código de verificación").fill(wrongCode(totpSecret));
    await page.getByRole("button", { name: "Verificar" }).click();
    await expect(formError(page)).toHaveText("El código no es correcto. Prueba con el que muestra ahora tu aplicación.");

    await completeMfa(page, totpSecret);
    await expect(page.getByTestId("current-user")).toHaveText(email);
  });

  // Con aal2 puede administrar: sin aviso y con el formulario de invitación.
  await page.goto("/app/ajustes/general");
  await expect(page.getByTestId("mfa-required")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Crear invitación" })).toBeVisible();
});

test("activar la verificación en dos pasos, entrar con ella y desactivarla", async ({ page }) => {
  const { email, password } = credentialsFor("guest_mfa");
  await signIn(page, "guest_mfa");
  await page.goto("/app/ajustes/seguridad");
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
  await signOutFromMenu(page);
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await completeMfa(page, secret);
  await expect(page.getByTestId("current-user")).toHaveText(email);

  // Desactivarla: Auth exige aal2 y la app, además, un código actual (auditoría
  // R-21). Con la sesión sola o un código incorrecto no se desactiva.
  await page.goto("/app/ajustes/seguridad");
  await page.getByLabel("Código actual").fill(wrongCode(secret));
  await page.getByRole("button", { name: "Desactivar la verificación en dos pasos" }).click();
  await expect(formError(page)).toHaveText("El código no es correcto. Prueba con el que muestra ahora la aplicación.");
  await page.reload();
  await expect(page.getByTestId("mfa-status")).toHaveText(/^Activada/);

  await page.getByLabel("Código actual").fill(totp(secret));
  await page.getByRole("button", { name: "Desactivar la verificación en dos pasos" }).click();
  await expect(page.getByTestId("mfa-status")).toHaveText("Desactivada.");
});

// Los códigos fallidos cuentan en el freno del login, y volver a entrar con la
// contraseña no lo vacía. Si lo vaciara, quien sepa la contraseña esperaría a que
// pase la primera espera (30 s), entraría de nuevo y tendría otros 5 intentos,
// sin la espera creciente. Usa una IP propia en cada ejecución (el freno cuenta
// por email e IP) para no depender de ejecuciones anteriores.
test("el freno de códigos MFA no se vacía volviendo a entrar con la contraseña", async ({ browser }) => {
  test.slow();
  const { email, password, totpSecret } = credentialsFor("guest_mfa_throttle");
  if (!totpSecret) throw new Error("El seed no ha dado de alta el TOTP de guest_mfa_throttle: ejecuta pnpm db:seed");
  const ip = `198.51.100.${Math.floor(Math.random() * 250) + 1}`;
  const context = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": ip } });
  const page = await context.newPage();
  const passwordLogin = async () => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Contraseña").fill(password);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/login\/mfa/);
  };
  const tryCode = async (code: string) => {
    await page.goto(page.url());
    await page.getByLabel("Código de verificación").fill(code);
    await page.getByRole("button", { name: "Verificar" }).click();
    await expect(formError(page)).toBeVisible();
    return formError(page).innerText();
  };
  const badCode = "El código no es correcto. Prueba con el que muestra ahora tu aplicación.";
  const tooMany = "Demasiados intentos. Espera unos minutos y vuelve a probarlo.";

  await passwordLogin();
  for (let attempt = 1; attempt <= 5; attempt++) expect(await tryCode(wrongCode(totpSecret))).toBe(badCode);
  // Frenado: ni el código correcto pasa.
  expect(await tryCode(totp(totpSecret))).toBe(tooMany);

  // Pasada la primera espera (30 s), vuelve a entrar con la contraseña.
  await page.getByRole("button", { name: "Salir" }).click();
  await page.waitForTimeout(31_000);
  await passwordLogin();
  // Un fallo más y vuelve a estar frenado (ahora 60 s): los 5 anteriores siguen contando.
  expect(await tryCode(wrongCode(totpSecret))).toBe(badCode);
  expect(await tryCode(wrongCode(totpSecret))).toBe(tooMany);
  await context.close();
});
