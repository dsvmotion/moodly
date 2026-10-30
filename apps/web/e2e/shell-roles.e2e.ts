import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { signIn } from "./helpers";

// App shell por rol (tarea 4): qué ve cada usuario del seed en la barra
// lateral, en el selector de alcance y en las tablas de Registros, en tema
// claro y oscuro. Expectativas escritas a mano (no derivadas del seed).
//
// Capturas: si SCREENSHOTS_DIR está definida, se guardan ahí (p. ej. una
// carpeta fuera del repo); si no, en test-results (ignorado por git y subido
// como artefacto en el CI).
const ROLES = {
  a_org_admin: {
    org: "Demo A",
    scope: ["Toda la organización", "A Norte", "A1 Norte", "A2 Norte", "A3 sin región"],
    locations: ["A1 Norte", "A2 Norte", "A3 sin región"],
    people: ["Admin A", "Encargado A1", "Región A Norte", "Staff A2"],
  },
  a_region_manager: {
    org: "Demo A",
    scope: ["Todos mis locales", "A Norte", "A1 Norte", "A2 Norte"],
    locations: ["A1 Norte", "A2 Norte"],
    people: ["Admin A", "Encargado A1", "Región A Norte", "Staff A2"],
  },
  a_location_manager: {
    org: "Demo A",
    scope: ["Todos mis locales", "A1 Norte"],
    locations: ["A1 Norte"],
    people: ["Admin A", "Encargado A1"],
  },
  a_staff: {
    org: "Demo A",
    scope: ["Todos mis locales", "A2 Norte"],
    locations: ["A2 Norte"],
    people: ["Admin A", "Staff A2"],
  },
  b_org_admin: {
    org: "Demo B",
    scope: ["Toda la organización", "B1"],
    locations: ["B1"],
    people: ["Admin B"],
  },
} as const;

const SIDEBAR_LINKS = [
  "Inicio", "Coach", "Aprobaciones", "Bandeja", "Tareas", "Actividad", "Informes",
  "Recepción", "Atención al cliente", "Comercial", "Administración",
  "Clientes", "Objetivos", "Conocimiento", "Memoria", "Ajustes",
];

async function shot(page: Page, testInfo: TestInfo, name: string) {
  const dir = process.env["SCREENSHOTS_DIR"];
  const path = dir ? join(dir, `${name}.png`) : testInfo.outputPath(`${name}.png`);
  if (dir) mkdirSync(dir, { recursive: true });
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running"));
  await page.screenshot({ path, fullPage: true });
}

async function firstColumn(page: Page, table: string): Promise<string[]> {
  const rows = page.getByTestId(`${table}-row`);
  await expect(rows.first()).toBeVisible();
  return (await rows.locator("td:nth-child(2)").allInnerTexts()).map((t) => t.trim());
}

for (const theme of ["light", "dark"] as const) {
  for (const [key, want] of Object.entries(ROLES)) {
    test(`${key} (${theme}): barra lateral, alcance y tablas`, async ({ page, context }, testInfo) => {
      await context.addCookies([{ name: "theme", value: theme, url: "http://127.0.0.1:3000" }]);
      await page.setViewportSize({ width: 1440, height: 900 });
      await signIn(page, key);
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);

      // Barra lateral: su organización y todas las secciones, sin contadores.
      const sidebar = page.getByRole("navigation", { name: "Navegación principal" });
      await expect(sidebar.getByTestId("org-name")).toHaveText(want.org);
      for (const name of SIDEBAR_LINKS) {
        await expect(sidebar.getByRole("link", { name, exact: true })).toBeVisible();
      }
      await expect(sidebar.locator('[data-slot="badge"]')).toHaveCount(0);

      // Selector de alcance: exactamente lo que ve.
      await page.getByTestId("scope-switcher").click();
      await expect(page.getByTestId("scope-options").getByRole("menuitemradio")).toHaveText([...want.scope]);
      await shot(page, testInfo, `${key}-${theme}-1-alcance`);
      await page.keyboard.press("Escape");

      // Ajustes → Sedes y Miembros (rutas del ADR 0023).
      await sidebar.getByRole("link", { name: "Ajustes", exact: true }).click();
      await page.getByTestId("settings-nav").getByRole("link", { name: "Sedes", exact: true }).click();
      await expect(page).toHaveURL(/\/app\/settings\/locations/);
      expect(await firstColumn(page, "locations-table")).toEqual([...want.locations]);
      await shot(page, testInfo, `${key}-${theme}-2-locales`);

      await page.getByTestId("locations-table-row").first().click();
      await expect(page.getByTestId("preview-drawer").getByRole("heading", { name: want.locations[0] })).toBeVisible();
      await shot(page, testInfo, `${key}-${theme}-3-vista-previa`);
      await page.keyboard.press("Escape");

      await page.getByTestId("settings-nav").getByRole("link", { name: "Miembros", exact: true }).click();
      await expect(page).toHaveURL(/\/app\/settings\/team/);
      expect(await firstColumn(page, "people-table")).toEqual([...want.people]);
      await shot(page, testInfo, `${key}-${theme}-4-personas`);
    });
  }
}
