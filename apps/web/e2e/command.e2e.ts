import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

// Paleta de comandos (MANUAL §9.2): ⌘K / Ctrl+K y "/" para navegar entre secciones.
const LOC_A1 = "5eed0002-0000-4000-8000-0000000000a1";
const palette = (page: import("@playwright/test").Page) => page.getByRole("dialog", { name: "Paleta de comandos" });

test.beforeEach(async ({ page }) => {
  await signIn(page, "a_org_admin");
});

test("⌘K / Ctrl+K abre la paleta y Enter navega a la sección", async ({ page }) => {
  await page.keyboard.press("ControlOrMeta+k");
  await expect(palette(page)).toBeVisible();
  await expect(palette(page).getByRole("combobox")).toBeFocused();
  await expect(palette(page).getByRole("combobox")).toHaveAttribute("placeholder", "Buscar secciones…");

  await page.keyboard.type("Tareas");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/app\/tareas$/);
  await expect(palette(page)).toBeHidden();
  await expect(page.getByRole("heading", { level: 1, name: "Tareas" })).toBeVisible();
});

test("ofrece todas las secciones agrupadas y filtra al escribir", async ({ page }) => {
  await page.keyboard.press("ControlOrMeta+k");
  const options = palette(page).getByRole("option");
  await expect(options).toHaveCount(28);
  await expect(palette(page).locator("[cmdk-group-heading]")).toHaveText(["Navegación", "Agentes", "Registros", "Ajustes"]);
  // Búsqueda aproximada (cmdk): filtra la lista y pone la mejor coincidencia primero.
  await page.keyboard.type("sede");
  await expect(options.first()).toHaveText("Sedes");
  expect(await options.count()).toBeLessThan(28);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/app\/ajustes\/sedes$/);
  await page.keyboard.press("ControlOrMeta+k");
  // Ninguna entrada lleva una «q». La búsqueda es aproximada: letras sueltas repetidas («zzz») pueden coincidir con alguna.
  await page.keyboard.type("qqq");
  await expect(options).toHaveCount(0);
  await expect(palette(page).getByText("Sin resultados.")).toBeVisible();
});

test("se navega con flechas y Escape cierra devolviendo el foco", async ({ page }) => {
  const search = page.getByTestId("global-search");
  await search.click();
  await expect(palette(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(palette(page)).toBeHidden();
  await expect(search).toBeFocused();

  await page.keyboard.press("ControlOrMeta+k");
  await page.keyboard.press("ArrowDown"); // 1.ª: Inicio → 2.ª: Coach
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/app\/coach$/);
});

test('"/" abre la paleta, pero no mientras se escribe en un campo', async ({ page }) => {
  await page.goto("/app/ajustes/sedes");
  await page.locator("body").press("/");
  await expect(palette(page)).toBeVisible();
  await page.keyboard.press("Escape");

  const input = page.getByTestId("locations-table-search");
  await input.fill("");
  await input.pressSequentially("a/b");
  await expect(input).toHaveValue("a/b");
  await expect(palette(page)).toBeHidden();
});

test("navegar desde la paleta conserva el alcance", async ({ page }) => {
  await page.goto(`/app/ajustes/sedes?scope=${encodeURIComponent(`location:${LOC_A1}`)}`);
  await page.keyboard.press("ControlOrMeta+k");
  await page.keyboard.type("Bandeja");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(new RegExp(`/app/conversaciones\\?scope=location%3A${LOC_A1}`));
  await expect(page.getByTestId("scope-switcher")).toContainText("A1 Norte");
});

test("en móvil, con el menú abierto, hay una sola paleta", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Abrir menú" }).click();
  // El botón de escritorio sigue en el DOM (oculto): se pulsa el del menú.
  await page.getByTestId("global-search").filter({ visible: true }).click();
  await expect(palette(page)).toHaveCount(1);
  await expect(palette(page)).toBeVisible();
});
