import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// Accesibilidad automática con axe (MANUAL §9.9, WCAG 2.1 AA). Por ahora solo
// la página de login; el app shell se añade en la tarea 4 junto con la
// navegación completa con teclado.
const WCAG_21_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

test("login: sin violaciones de WCAG 2.1 AA", async ({ page }) => {
  await page.goto("/login");
  const results = await new AxeBuilder({ page }).withTags(WCAG_21_AA).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
});
