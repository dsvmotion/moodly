import { expect, test, type Locator, type Page } from "@playwright/test";
import { signIn } from "./helpers";

// Navegación completa con teclado (MANUAL §9.9, WCAG 2.1.1): todo lo que hace
// el ratón en el app shell se puede hacer solo con el teclado.

/** Pulsa Tab hasta que el foco llegue al elemento (falla si no llega). */
async function tabTo(page: Page, target: Locator, max = 60) {
  for (let i = 0; i < max; i++) {
    await page.keyboard.press("Tab");
    if (await target.evaluate((el) => el === document.activeElement)) return;
  }
  throw new Error("El foco no llegó al elemento con Tab");
}

/** Dentro de un menú abierto, pulsa ↓ hasta que el foco llegue a la opción (falla si no llega). */
async function arrowTo(page: Page, target: Locator, max = 20) {
  for (let i = 0; i < max; i++) {
    if (await target.evaluate((el) => el === document.activeElement)) return;
    await page.keyboard.press("ArrowDown");
  }
  throw new Error("El foco no llegó a la opción con ↓");
}

test.beforeEach(async ({ page }) => {
  await signIn(page, "a_org_admin");
  await page.locator("body").click({ position: { x: 1, y: 1 } });
});

test("navegación lateral solo con teclado", async ({ page }) => {
  const sidebar = page.getByRole("navigation", { name: "Navegación principal" });
  const inbox = sidebar.getByRole("link", { name: "Bandeja", exact: true });
  await tabTo(page, inbox);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/app\/inbox/);

  // Una sección plegable se abre con Enter.
  const favorites = sidebar.getByRole("button", { name: "Favoritos" });
  await tabTo(page, favorites);
  await page.keyboard.press("Enter");
  await expect(favorites).toHaveAttribute("aria-expanded", "true");
});

test("selector de alcance solo con teclado", async ({ page }) => {
  const trigger = page.getByTestId("scope-switcher");
  await tabTo(page, trigger);
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("scope-options")).toBeVisible();
  // Al abrir con teclado, el foco entra en la primera opción; esperar a que
  // esté ahí antes de usar las flechas (si no, las pulsaciones se pierden).
  await expect(page.getByRole("menuitemradio", { name: "Toda la organización" })).toBeFocused();
  // Opciones: Toda la organización, A Norte, A1, A2, A3 → bajar hasta A1 Norte.
  // Radix mueve el foco en el siguiente ciclo: se espera a cada paso, como
  // haría una persona, antes de pulsar la siguiente flecha.
  for (const name of ["A Norte", "A1 Norte"]) {
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("menuitemradio", { name, exact: true })).toBeFocused();
  }
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/scope=location%3A/);
  await expect(trigger).toContainText("A1 Norte");
  await expect(trigger).toBeFocused();
});

test("tema e idioma solo con teclado, desde el menú de usuario", async ({ page }) => {
  const trigger = page.getByTestId("user-menu");
  await tabTo(page, trigger);
  await page.keyboard.press("Enter");
  await arrowTo(page, page.getByTestId("theme-switcher").getByRole("menuitemradio", { name: "Oscuro" }));
  await page.keyboard.press("Enter");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  // Al cerrarse, el foco vuelve al botón del menú.
  await expect(trigger).toBeFocused();

  await page.keyboard.press("Enter");
  await arrowTo(page, page.getByTestId("language-switcher").getByRole("menuitemradio", { name: "English" }));
  await page.keyboard.press("Enter");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});

test("tabla y vista previa solo con teclado", async ({ page }) => {
  await page.goto("/app/settings/locations");
  await page.locator("body").click({ position: { x: 1, y: 1 } });
  const search = page.getByTestId("locations-table-search");
  await tabTo(page, search);
  await page.keyboard.type("A3");

  const row = page.getByTestId("locations-table-row").first();
  await tabTo(page, row);
  await page.keyboard.press("Enter");
  const drawer = page.getByTestId("preview-drawer");
  await expect(drawer.getByRole("heading", { name: "A3 sin región" })).toBeVisible();
  // El foco queda atrapado en el panel mientras está abierto.
  await page.keyboard.press("Tab");
  await expect(drawer.locator(":focus")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(row).toBeFocused();
});
