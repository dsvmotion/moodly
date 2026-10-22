import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

// Organización activa (re-auditoría, hallazgo 1.6). staff.de trabaja en Demo D y
// Demo E (seedExtraMemberships); D y E solo las usa este test.
const ORG_A = "5eed0000-0000-4000-8000-00000000000a";

test("quien pertenece a dos organizaciones trabaja con una y la cambia desde la barra lateral", async ({ page, context }) => {
  await signIn(page, "de_staff");
  const switcher = page.getByTestId("org-switcher");
  const rows = page.getByTestId("locations-table-row");

  // Sin elegir: la primera por nombre.
  await page.goto("/app/records/locations");
  await expect(switcher.locator("option:checked")).toHaveText("Demo D");
  await expect(rows).toHaveCount(1);
  await expect(rows).toContainText("D1");

  // Cambia a E: solo sus locales, y se recuerda al recargar.
  await switcher.selectOption({ label: "Demo E" });
  await expect(page).toHaveURL(/\/app\/records\/locations$/);
  await expect(switcher.locator("option:checked")).toHaveText("Demo E");
  await expect(rows).toHaveCount(1);
  await expect(rows).toContainText("E1");
  await page.reload();
  await expect(switcher.locator("option:checked")).toHaveText("Demo E");
  await expect(rows).toContainText("E1");

  // Una cookie con una organización ajena no da acceso: vuelve a la primera suya.
  await context.addCookies([{ name: "org", value: ORG_A, url: "http://127.0.0.1:3000" }]);
  await page.reload();
  await expect(switcher.locator("option:checked")).toHaveText("Demo D");
  await expect(rows).toHaveCount(1);
  await expect(rows).toContainText("D1");
});

test("con una sola organización no hay selector, solo su nombre", async ({ page }) => {
  await signIn(page, "a_staff");
  await expect(page.getByTestId("org-switcher")).toHaveCount(0);
  await expect(page.getByTestId("org-name")).toHaveText("Demo A");
});
