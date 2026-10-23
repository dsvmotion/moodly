import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./helpers";

// Accesibilidad automática (axe, WCAG 2.1 AA) del app shell y sus pantallas,
// en claro y en oscuro (el contraste cambia con el tema), y con los menús y
// paneles abiertos. La página de login tiene su test en a11y.e2e.ts.
const WCAG_21_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

async function expectNoViolations(page: Page, where: string) {
  // Medir el estado final: durante las animaciones de entrada (opacidad) el
  // contraste calculado es menor que el real y el resultado sería inestable.
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running"));
  const results = await new AxeBuilder({ page }).withTags(WCAG_21_AA).analyze();
  const violations = results.violations.map(
    (v) => `${where} · ${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")})`,
  );
  expect(violations).toEqual([]);
}

for (const theme of ["light", "dark"] as const) {
  test.describe(`tema ${theme}`, () => {
    test.beforeEach(async ({ page, context }) => {
      await context.addCookies([{ name: "theme", value: theme, url: "http://127.0.0.1:3000" }]);
      await signIn(page, "a_org_admin");
    });

    test("pantallas de la app", async ({ page }) => {
      for (const path of [
        "/app/ajustes/general",
        "/app/ajustes/seguridad",
        "/app/conversaciones",
        "/app/ajustes/sedes",
        "/app/ajustes/equipo",
        "/app/agentes",
        "/app/agentes/reception",
      ]) {
        await page.goto(path);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await expectNoViolations(page, path);
      }
    });

    test("menús, paneles y paleta abiertos", async ({ page }) => {
      await page.goto("/app/ajustes/sedes");
      await page.getByTestId("locations-table-row").first().click();
      await expect(page.getByTestId("preview-drawer")).toBeVisible();
      await expectNoViolations(page, "vista previa");
      await page.keyboard.press("Escape");

      await page.getByTestId("scope-switcher").click();
      await expect(page.getByTestId("scope-options")).toBeVisible();
      await expectNoViolations(page, "selector de alcance");
      await page.keyboard.press("Escape");

      await page.keyboard.press("ControlOrMeta+k");
      await expect(page.getByRole("dialog", { name: "Paleta de comandos" })).toBeVisible();
      await expectNoViolations(page, "paleta de comandos");
      await page.keyboard.press("Escape");

      await page.getByRole("button", { name: "Compactar barra lateral" }).click();
      await expectNoViolations(page, "barra lateral compacta");
    });
  });
}

test("menú móvil abierto, en inglés", async ({ page, context }) => {
  await context.addCookies([{ name: "locale", value: "en", url: "http://127.0.0.1:3000" }]);
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, "a_location_manager");
  await page.getByRole("button", { name: "Open menu" }).click();
  await expect(page.getByRole("navigation", { name: "Main navigation" })).toBeVisible();
  await expectNoViolations(page, "menú móvil (en)");
});
