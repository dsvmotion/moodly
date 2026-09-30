import { expect, test } from "@playwright/test";
import { signIn, texts } from "./helpers";

// Qué debe ver cada rol del seed en "Mi organización" (MANUAL §4.4). Escrito a
// mano, no derivado del seed: si cambian RLS o el seed, este test lo detecta.
//
// Demo A: región "A Norte" con A1 y A2; A3 sin región.
//   org_admin → todo A · region_manager (A Norte) → A1 y A2
//   location_manager (A1) → A1 · staff (A2) → A2
// Demo B: B1 y su org_admin; nada de A.
// Personas: cada uno se ve a sí mismo y a los org_admin de su organización;
// los managers, además, a quien comparte alcance con ellos.
const expectations = {
  a_org_admin: {
    organizations: ["Demo A"],
    locations: ["A1 Norte", "A2 Norte", "A3 sin región"],
    people: ["Admin A", "Encargado A1", "Región A Norte", "Staff A2"],
  },
  a_region_manager: {
    organizations: ["Demo A"],
    locations: ["A1 Norte", "A2 Norte"],
    people: ["Admin A", "Encargado A1", "Región A Norte", "Staff A2"],
  },
  a_location_manager: {
    organizations: ["Demo A"],
    locations: ["A1 Norte"],
    people: ["Admin A", "Encargado A1"],
  },
  a_staff: {
    organizations: ["Demo A"],
    locations: ["A2 Norte"],
    people: ["Admin A", "Staff A2"],
  },
  b_org_admin: {
    organizations: ["Demo B"],
    locations: ["B1"],
    people: ["Admin B"],
  },
} as const;

for (const [key, expected] of Object.entries(expectations)) {
  test(`${key} ve exactamente su organización, sus locales y sus personas`, async ({ page }, testInfo) => {
    await signIn(page, key);
    await expect(page).toHaveURL(/\/app\/settings\/organization$/);
    await expect(page.getByRole("heading", { name: "Mi organización" })).toBeVisible();

    expect(await texts(page, "organization")).toEqual(expected.organizations);
    expect(await texts(page, "location-name")).toEqual(expected.locations);
    expect(await texts(page, "person-name")).toEqual(expected.people);

    await testInfo.attach(`${key}.png`, { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
    await page.screenshot({ path: testInfo.outputPath(`${key}.png`), fullPage: true });
  });
}

test("el org_admin de B no ve nada de A", async ({ page }) => {
  await signIn(page, "b_org_admin");
  await expect(page.getByText(/Demo A|A\d (Norte|sin región)|Admin A|Encargado A1|Staff A2/)).toHaveCount(0);
});
