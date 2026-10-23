import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { credentialsFor, withMfaLock } from "./helpers";

// Accesibilidad automática con axe (MANUAL §9.9, WCAG 2.1 AA) de las pantallas
// de acceso, en claro y en oscuro. El app shell tiene su test en a11y-app.e2e.ts.
const WCAG_21_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

async function expectNoViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(WCAG_21_AA).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
}

for (const theme of ["light", "dark"] as const) {
  test(`login (${theme}): sin violaciones de WCAG 2.1 AA`, async ({ page, context }) => {
    await context.addCookies([{ name: "theme", value: theme, url: "http://127.0.0.1:3000" }]);
    await page.goto("/login");
    await expectNoViolations(page);

    // También con el error visible.
    await page.getByLabel("Email").fill(`no-existe-${Date.now()}@demo.test`);
    await page.getByLabel("Contraseña").fill("contraseña-incorrecta-123");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.locator('form p[role="alert"]')).toBeVisible();
    await expectNoViolations(page);
  });
}

test("segundo paso (código MFA): sin violaciones de WCAG 2.1 AA", async ({ page }) => {
  const { email, password } = credentialsFor("a_org_admin");
  await withMfaLock("a_org_admin", async () => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Contraseña").fill(password);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Verificación en dos pasos" })).toBeVisible();
    await expectNoViolations(page);
  });
});
