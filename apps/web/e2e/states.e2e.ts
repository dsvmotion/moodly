import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

// Estados de la app (revisión del diseño §4): «no encontrado» dentro de la app
// (con la barra lateral para seguir) y fuera de ella (con el marco del login),
// siempre con su código 404. El estado de error se prueba en
// error-panel.test.tsx: provocar un fallo real del servidor desde un e2e
// exigiría una puerta trasera en la app.

const WCAG_21_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

test("dentro de la app, lo que no existe da 404 sin salir de la app y lleva al inicio", async ({ page }) => {
  await signIn(page, "a_org_admin");
  const response = await page.goto("/app/agents/marketing");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1, name: "No encontrado" })).toBeVisible();
  await expect(page.getByTestId("not-found")).toContainText("Esta página no existe o no está disponible para ti");
  await expect(page.getByRole("navigation", { name: "Navegación principal" })).toBeVisible();

  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running"));
  const results = await new AxeBuilder({ page }).withTags(WCAG_21_AA).analyze();
  expect(results.violations.map((v) => v.id)).toEqual([]);

  await page.getByRole("link", { name: "Ir al inicio" }).click();
  await expect(page).toHaveURL(/\/app$/);
});

test("fuera de la app, una dirección que no existe da 404 con el marco del login", async ({ page }) => {
  // Sin sesión, el proxy manda al login antes de llegar aquí; con sesión, el 404.
  await signIn(page, "a_staff");
  const response = await page.goto("/esto-no-existe");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1, name: "No encontrado" })).toBeVisible();
  await expect(page.getByTestId("not-found-home")).toHaveAttribute("href", "/app");

  const results = await new AxeBuilder({ page }).withTags(WCAG_21_AA).analyze();
  expect(results.violations.map((v) => v.id)).toEqual([]);
});
