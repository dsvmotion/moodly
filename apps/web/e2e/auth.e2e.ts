import { expect, test } from "@playwright/test";
import { credentialsFor, signIn } from "./helpers";

test("sin sesión, las rutas privadas llevan al login y, tras entrar, al destino pedido", async ({ page }) => {
  await page.goto("/app/settings/general");
  await expect(page).toHaveURL(/\/login\?next=%2Fapp%2Fsettings%2Fgeneral$/);

  const { email, password } = credentialsFor("a_staff");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/app\/settings\/general$/);
});

test("contraseña incorrecta: error genérico y sin sesión", async ({ page }) => {
  const { email } = credentialsFor("a_org_admin");
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("contraseña-incorrecta");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("Incorrect email or password.");

  await page.goto("/app");
  await expect(page).toHaveURL(/\/login/);
});

// Sin idioma elegido, el acceso sale en inglés (ADR 0041): antes de entrar no se
// sabe de qué organización es la persona.
test("la pantalla de acceso lleva la marca, sale en inglés y dice que se entra por invitación", async ({ page }) => {
  await page.goto("/login");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("heading", { level: 1, name: "Sign in to Moodly" })).toBeVisible();
  await expect(page.getByRole("main").getByRole("img", { name: "Moodly" })).toBeVisible();
  await expect(page.getByRole("main")).toContainText("Access is by invitation from your organization.");
});

test("en español, el acceso y sus errores están traducidos (sin revelar si la cuenta existe)", async ({ page, context }) => {
  await context.addCookies([{ name: "locale", value: "es", url: "http://127.0.0.1:3000" }]);
  await page.goto("/login");
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await expect(page.getByRole("heading", { level: 1, name: "Entrar en Moodly" })).toBeVisible();
  await expect(page.getByRole("main")).toContainText("Se entra por invitación de tu organización.");
  await page.getByLabel("Email").fill(`no-existe-${Date.now()}@demo.test`);
  await page.getByLabel("Contraseña").fill("no-es-la-clave-123");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("Email o contraseña incorrectos.");
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
  // Auditoría de preproducción, G-02: el segmento de punto (también "%2e")
  // desaparece al resolver la URL y lo que queda es "//evil.test".
  "/.//evil.test/robar",
  "/app/..//evil.test/robar",
  "/%2e//evil.test/robar",
];

for (const next of externalNextValues) {
  test(`next=${JSON.stringify(next)} no redirige fuera de la app`, async ({ page }) => {
    await signIn(page, "a_org_admin", next);
    // Cae a Inicio, dentro de la app: mismo origen y ruta exacta.
    await expect(page).toHaveURL(/^http:\/\/127\.0\.0\.1:3000\/app$/);
  });

  // Quien ya tiene sesión no pasa por el formulario: /login lo redirige
  // directamente a `next`. Por el formulario el destino se limpia dos veces (al
  // pintarlo y al enviarlo); aquí, una sola: por este camino salía G-02.
  test(`con sesión, /login?next=${JSON.stringify(next)} no redirige fuera de la app`, async ({ page }) => {
    await signIn(page, "a_staff");
    const target = `/login?next=${encodeURIComponent(next)}`;
    // Primero la respuesta de /login sin seguirla: a dónde manda al navegador.
    const response = await page.request.get(target, { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    const location = new URL(response.headers()["location"] ?? "", page.url());
    expect(`${location.origin}${location.pathname}`).toBe("http://127.0.0.1:3000/app");
    // Y en el navegador: acaba en Inicio.
    await page.goto(target);
    await expect(page).toHaveURL(/^http:\/\/127\.0\.0\.1:3000\/app$/);
  });
}

test("con sesión, /login redirige a la app", async ({ page }) => {
  await signIn(page, "b_org_admin");
  await page.goto("/login");
  await expect(page).toHaveURL(/\/app$/);
});
