import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

// Barra lateral del app shell (MANUAL §9.2).
const MAIN = ["Inicio", "Coach", "Aprobaciones", "Bandeja", "Tareas", "Actividad", "Analítica"];
const RECORDS = ["Clientes", "Conversaciones", "Recomendaciones", "Objetivos", "Conocimiento", "Memoria", "Locales", "Personas"];

test.describe("barra lateral", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, "a_org_admin");
    // Hasta que React hidrata, los botones de la barra no responden: con la
    // máquina cargada, un clic temprano se perdía.
    await expect(page.getByRole("navigation", { name: "Navegación principal" })).toHaveAttribute("data-hydrated", "true");
  });

  test("muestra las secciones del §9.2 sin contadores ni elementos inventados", async ({ page }) => {
    const sidebar = page.getByRole("navigation", { name: "Navegación principal" });
    await expect(sidebar).toBeVisible();
    await expect(sidebar.getByTestId("org-name")).toHaveText("Demo A");

    for (const name of [...MAIN, ...RECORDS, "Ajustes"]) {
      await expect(sidebar.getByRole("link", { name, exact: true })).toBeVisible();
    }
    await expect(sidebar.getByText("Los agentes aparecerán aquí cuando se configuren.")).toBeVisible();
    // Sin datos: ningún contador de pendientes.
    await expect(sidebar.locator('[data-slot="badge"]')).toHaveCount(0);
  });

  test("las secciones se pliegan y despliegan", async ({ page }) => {
    const sidebar = page.getByRole("navigation", { name: "Navegación principal" });
    const savedViews = sidebar.getByRole("button", { name: "Vistas guardadas" });
    await expect(savedViews).toHaveAttribute("aria-expanded", "false");
    await savedViews.click();
    await expect(savedViews).toHaveAttribute("aria-expanded", "true");
    await expect(sidebar.getByText("Aún no hay vistas guardadas.")).toBeVisible();

    const records = sidebar.getByRole("button", { name: "Registros" });
    await records.click();
    await expect(sidebar.getByRole("link", { name: "Locales", exact: true })).toBeHidden();
  });

  test("navega a cada sección con su estado vacío, entrada activa y migas", async ({ page }) => {
    const sidebar = page.getByRole("navigation", { name: "Navegación principal" });
    await sidebar.getByRole("link", { name: "Bandeja", exact: true }).click();
    await expect(page).toHaveURL(/\/app\/inbox$/);
    await expect(page.getByRole("heading", { level: 1, name: "Bandeja" })).toBeVisible();
    await expect(page.getByTestId("section-empty")).toBeVisible();
    await expect(sidebar.getByRole("link", { name: "Bandeja", exact: true })).toHaveAttribute("aria-current", "page");
    await expect(page.getByTestId("breadcrumbs")).toHaveText("Bandeja");

    await sidebar.getByRole("link", { name: "Clientes", exact: true }).click();
    await expect(page).toHaveURL(/\/app\/records\/contacts$/);
    await expect(page.getByTestId("breadcrumbs")).toHaveText("Registros/Clientes");
    await expect(sidebar.getByRole("link", { name: "Bandeja", exact: true })).not.toHaveAttribute("aria-current", "page");
  });

  test("se compacta a iconos, conserva los nombres accesibles y lo recuerda", async ({ page }) => {
    const sidebar = page.getByRole("navigation", { name: "Navegación principal" });
    await sidebar.getByRole("button", { name: "Compactar barra lateral" }).click();
    await expect(sidebar).toHaveAttribute("data-collapsed", "true");
    // Las etiquetas se ocultan visualmente, pero los enlaces siguen teniendo nombre.
    await expect(sidebar.getByRole("link", { name: "Bandeja", exact: true })).toBeVisible();

    await page.reload();
    await expect(sidebar).toHaveAttribute("data-collapsed", "true");
    await sidebar.getByRole("button", { name: "Expandir barra lateral" }).click();
    await expect(sidebar).toHaveAttribute("data-collapsed", "false");
  });

  test("cambia entre tema claro, oscuro y del sistema, y lo recuerda", async ({ page }) => {
    const html = page.locator("html");
    const themes = page.getByTestId("theme-switcher");
    await themes.getByRole("radio", { name: "Oscuro" }).click();
    await expect(html).toHaveAttribute("data-theme", "dark");
    await page.reload();
    await expect(html).toHaveAttribute("data-theme", "dark");
    await expect(themes.getByRole("radio", { name: "Oscuro" })).toHaveAttribute("aria-checked", "true");

    await themes.getByRole("radio", { name: "Claro" }).click();
    await expect(html).toHaveAttribute("data-theme", "light");
    await themes.getByRole("radio", { name: "Sistema" }).click();
    await expect(html).not.toHaveAttribute("data-theme", /.+/);
  });

  test("el primer Tab ofrece saltar al contenido", async ({ page }) => {
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Saltar al contenido" });
    await expect(skip).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("#main-content")).toBeFocused();
  });
});

test("cada usuario ve el nombre de su organización", async ({ page }) => {
  await signIn(page, "b_org_admin");
  await expect(page.getByTestId("org-name")).toHaveText("Demo B");
});

test("en móvil la barra lateral se abre desde el menú", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, "a_staff");
  const sidebar = page.getByRole("navigation", { name: "Navegación principal" });
  await expect(sidebar).toBeHidden();
  await page.getByRole("button", { name: "Abrir menú" }).click();
  await expect(sidebar).toBeVisible();
  await sidebar.getByRole("link", { name: "Aprobaciones", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/approvals$/);
  await expect(sidebar).toBeHidden();
});
