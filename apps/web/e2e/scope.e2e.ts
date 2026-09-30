import { expect, test, type Page } from "@playwright/test";
import { signIn, texts } from "./helpers";

// Selector de alcance (MANUAL §9.2): solo ofrece lo que el usuario ve según
// RLS, filtra la vista y vive en la URL (?scope=).
// Ids fijos del seed (packages/db/src/seed/data.ts).
const REGION_A_NORTE = "5eed0001-0000-4000-8000-0000000000a1";
const LOC_A1 = "5eed0002-0000-4000-8000-0000000000a1";
const LOC_A2 = "5eed0002-0000-4000-8000-0000000000a2";
const LOC_A3 = "5eed0002-0000-4000-8000-0000000000a3";
const LOC_B1 = "5eed0002-0000-4000-8000-0000000000b1";

async function scopeOptions(page: Page): Promise<string[]> {
  await page.getByTestId("scope-switcher").click();
  const items = page.getByTestId("scope-options").getByRole("menuitemradio");
  const labels = (await items.allInnerTexts()).map((t) => t.trim());
  await page.keyboard.press("Escape");
  return labels;
}

async function chooseScope(page: Page, label: string) {
  await page.getByTestId("scope-switcher").click();
  await page.getByTestId("scope-options").getByRole("menuitemradio", { name: label, exact: true }).click();
}

const expectedOptions = {
  a_org_admin: ["Toda la organización", "A Norte", "A1 Norte", "A2 Norte", "A3 sin región"],
  a_region_manager: ["Todos mis locales", "A Norte", "A1 Norte", "A2 Norte"],
  a_location_manager: ["Todos mis locales", "A1 Norte"],
  a_staff: ["Todos mis locales", "A2 Norte"],
  b_org_admin: ["Toda la organización", "B1"],
} as const;

for (const [key, expected] of Object.entries(expectedOptions)) {
  test(`${key}: el selector solo ofrece lo que ve`, async ({ page }) => {
    await signIn(page, key);
    expect(await scopeOptions(page)).toEqual(expected);
  });
}

test("org_admin: filtrar por región y por local cambia la vista y la URL", async ({ page }) => {
  await signIn(page, "a_org_admin");
  await expect(page.getByTestId("location-name")).toHaveCount(3);

  await chooseScope(page, "A Norte");
  await expect(page).toHaveURL(new RegExp(`scope=region%3A${REGION_A_NORTE}`));
  await expect(page.getByTestId("scope-switcher")).toContainText("A Norte");
  expect(await texts(page, "location-name")).toEqual(["A1 Norte", "A2 Norte"]);
  expect(await texts(page, "person-name")).toEqual(["Admin A", "Encargado A1", "Región A Norte", "Staff A2"]);

  await chooseScope(page, "A3 sin región");
  await expect(page).toHaveURL(new RegExp(`scope=location%3A${LOC_A3}`));
  expect(await texts(page, "location-name")).toEqual(["A3 sin región"]);
  expect(await texts(page, "person-name")).toEqual(["Admin A"]);

  await chooseScope(page, "Toda la organización");
  await expect(page).not.toHaveURL(/scope=/);
  await expect(page.getByTestId("location-name")).toHaveCount(3);
});

test("el alcance se conserva al navegar por la barra lateral", async ({ page }) => {
  await signIn(page, "a_region_manager");
  await chooseScope(page, "A1 Norte");
  await expect(page).toHaveURL(new RegExp(`scope=location%3A${LOC_A1}`));

  const sidebar = page.getByRole("navigation", { name: "Navegación principal" });
  await sidebar.getByRole("link", { name: "Bandeja", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/app/inbox\\?scope=location%3A${LOC_A1}`));
  await expect(page.getByTestId("scope-switcher")).toContainText("A1 Norte");

  await sidebar.getByRole("link", { name: "Ajustes", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/app/settings/organization\\?scope=location%3A${LOC_A1}`));
  await expect(page.getByTestId("location-name")).toHaveText(["A1 Norte"]);
});

test("una URL con un alcance ajeno no filtra nada ajeno: cae a todo lo que ve", async ({ page }) => {
  await signIn(page, "a_location_manager");
  for (const foreign of [`location:${LOC_A2}`, `location:${LOC_B1}`, `region:${REGION_A_NORTE}`, "basura"]) {
    await page.goto(`/app/settings/organization?scope=${encodeURIComponent(foreign)}`);
    await expect(page.getByTestId("scope-switcher")).toContainText("Todos mis locales");
    await expect(page.getByTestId("location-name")).toHaveText(["A1 Norte"]);
    await expect(page.getByText(/A2 Norte|A3 sin región|B1/)).toHaveCount(0);
  }
});
