import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

// Freno a la fuerza bruta en el login (migración login_throttle): tras 5 fallos
// con el mismo email desde la misma IP hay que esperar, y el resto de usuarios
// sigue entrando con normalidad. Usa un email inventado y distinto en cada
// ejecución para no frenar a los usuarios del seed.

test("tras 5 fallos con el mismo email hay que esperar; el resto sigue entrando", async ({ page, browser }) => {
  const email = `fuerza-bruta-${Date.now()}@demo.test`;
  // El error del formulario (Next añade otro role="alert": su anunciador de rutas).
  // Cada intento empieza en una página nueva, así el mensaje aparece de nuevo.
  const attempt = async () => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Contraseña").fill("NoEsLaClave-123");
    await page.getByRole("button", { name: "Entrar" }).click();
    const error = page.locator('form p[role="alert"]');
    await expect(error).toBeVisible();
    return error.innerText();
  };

  for (let i = 1; i <= 5; i++) {
    expect(await attempt()).toBe("Email o contraseña incorrectos.");
  }
  expect(await attempt()).toBe("Demasiados intentos. Espera unos minutos y vuelve a probarlo.");

  // Otro usuario, desde la misma IP, entra sin problema.
  const other = await browser.newPage();
  await signIn(other, "b_org_admin");
  await other.close();
});
