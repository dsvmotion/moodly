import { expect, test } from "@playwright/test";
import { credentialsFor, openUserMenu, signIn } from "./helpers";

// Barra lateral del app shell (MANUAL §9.2), con las rutas canónicas del ADR 0023.
const MAIN = ["Inicio", "Coach", "Aprobaciones", "Bandeja", "Tareas", "Actividad", "Informes"];
const AGENTS = ["Recepción", "Atención al cliente", "Comercial", "Administración"];
const RECORDS = ["Clientes", "Objetivos", "Conocimiento", "Memoria"];

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
    await expect(sidebar.getByRole("img", { name: "Moodly" })).toBeVisible();

    for (const name of [...MAIN, ...AGENTS, ...RECORDS, "Ajustes"]) {
      await expect(sidebar.getByRole("link", { name, exact: true })).toBeVisible();
    }
    // Una entrada por destino (auditoría del frontend, F-6): sin duplicados.
    for (const name of ["Conversaciones", "Recomendaciones", "Locales", "Personas"]) {
      await expect(sidebar.getByRole("link", { name, exact: true })).toHaveCount(0);
    }
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
    await expect(sidebar.getByRole("link", { name: "Clientes", exact: true })).toBeHidden();
  });

  test("navega a cada sección con su estado vacío, entrada activa y migas", async ({ page }) => {
    const sidebar = page.getByRole("navigation", { name: "Navegación principal" });
    // Tareas sigue sin contenido (la Bandeja ya tiene el suyo: inbox.e2e.ts).
    await sidebar.getByRole("link", { name: "Tareas", exact: true }).click();
    await expect(page).toHaveURL(/\/app\/tasks$/);
    await expect(page.getByRole("heading", { level: 1, name: "Tareas" })).toBeVisible();
    await expect(page.getByTestId("section-empty")).toBeVisible();
    await expect(sidebar.getByRole("link", { name: "Tareas", exact: true })).toHaveAttribute("aria-current", "page");
    await expect(page.getByTestId("breadcrumbs")).toHaveText("Tareas");

    await sidebar.getByRole("link", { name: "Clientes", exact: true }).click();
    await expect(page).toHaveURL(/\/app\/contacts$/);
    await expect(page.getByTestId("breadcrumbs")).toHaveText("Registros/Clientes");
    await expect(sidebar.getByRole("link", { name: "Tareas", exact: true })).not.toHaveAttribute("aria-current", "page");
  });

  test("cada agente de serie tiene su ventana, sin datos inventados", async ({ page }) => {
    const sidebar = page.getByRole("navigation", { name: "Navegación principal" });
    await sidebar.getByRole("link", { name: "Recepción", exact: true }).click();
    await expect(page).toHaveURL(/\/app\/agents\/reception$/);
    await expect(page.getByRole("heading", { level: 1, name: "Recepción" })).toBeVisible();
    await expect(page.getByTestId("agent-status")).toHaveText("Sin configurar");
    await expect(page.getByTestId("breadcrumbs")).toHaveText("Agentes/Recepción");
    await expect(sidebar.getByRole("link", { name: "Recepción", exact: true })).toHaveAttribute("aria-current", "page");

    await page.goto("/app/agents");
    await expect(page.getByTestId("agent-cards").getByRole("link")).toHaveCount(4);

    // Una clave que no es de los 4 de serie no existe.
    const response = await page.goto("/app/agents/marketing");
    expect(response?.status()).toBe(404);
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
    // El tema está en el menú de usuario (F-4); elegir una opción cierra el menú.
    await openUserMenu(page);
    await themes.getByRole("menuitemradio", { name: "Oscuro" }).click();
    await expect(html).toHaveAttribute("data-theme", "dark");
    await page.reload();
    await expect(html).toHaveAttribute("data-theme", "dark");
    await openUserMenu(page);
    await expect(themes.getByRole("menuitemradio", { name: "Oscuro" })).toHaveAttribute("aria-checked", "true");

    await themes.getByRole("menuitemradio", { name: "Claro" }).click();
    await expect(html).toHaveAttribute("data-theme", "light");
    await openUserMenu(page);
    await themes.getByRole("menuitemradio", { name: "Sistema" }).click();
    await expect(html).not.toHaveAttribute("data-theme", /.+/);
  });

  test("el menú de usuario dice quién es y en qué organización, y lleva a su seguridad", async ({ page }) => {
    const { email } = credentialsFor("a_org_admin");
    const trigger = page.getByTestId("user-menu");
    await expect(trigger.getByTestId("user-name")).toHaveText("Admin A");
    await expect(trigger.getByTestId("current-user")).toHaveText(email);

    await openUserMenu(page);
    await expect(page.getByTestId("user-context")).toHaveText("Administración · Demo A");
    await page.getByRole("menuitem", { name: "Seguridad de la cuenta" }).click();
    await expect(page).toHaveURL(/\/app\/settings\/security$/);

    await openUserMenu(page);
    await page.getByRole("menuitem", { name: "Ajustes de la organización" }).click();
    await expect(page).toHaveURL(/\/app\/settings\/general$/);
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
