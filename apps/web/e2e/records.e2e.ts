import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./helpers";

// Registros → Locales y Personas (P2) con vista previa lateral (P4), sobre
// datos reales del seed leídos con RLS. Expectativas escritas a mano.
const LOC_A1 = "5eed0002-0000-4000-8000-0000000000a1";
const LOC_A2 = "5eed0002-0000-4000-8000-0000000000a2";

const expected = {
  a_org_admin: {
    locations: ["A1 Norte", "A2 Norte", "A3 sin región"],
    people: ["Admin A", "Encargado A1", "Región A Norte", "Staff A2"],
  },
  a_region_manager: { locations: ["A1 Norte", "A2 Norte"], people: ["Admin A", "Encargado A1", "Región A Norte", "Staff A2"] },
  a_location_manager: { locations: ["A1 Norte"], people: ["Admin A", "Encargado A1"] },
  a_staff: { locations: ["A2 Norte"], people: ["Admin A", "Staff A2"] },
  b_org_admin: { locations: ["B1"], people: ["Admin B"] },
} as const;

async function firstColumn(page: Page, table: string): Promise<string[]> {
  const rows = page.getByTestId(`${table}-row`);
  await expect(rows.first()).toBeVisible();
  return (await rows.locator("td:nth-child(2)").allInnerTexts()).map((t) => t.trim());
}

for (const [key, want] of Object.entries(expected)) {
  test(`${key}: tablas de Locales y Personas con lo que ve según RLS`, async ({ page }) => {
    await signIn(page, key);
    await page.goto("/app/records/locations");
    expect(await firstColumn(page, "locations-table")).toEqual(want.locations);
    await expect(page.getByTestId("locations-table-count")).toHaveText(`${want.locations.length} de ${want.locations.length}`);

    await page.goto("/app/records/people");
    expect(await firstColumn(page, "people-table")).toEqual(want.people);
  });
}

test("vista previa: se abre con clic y con teclado, va en la URL y sobrevive a recargar", async ({ page }) => {
  await signIn(page, "a_org_admin");
  await page.goto("/app/records/locations");

  await page.getByTestId("locations-table-row").filter({ hasText: "A1 Norte" }).click();
  const drawer = page.getByTestId("preview-drawer");
  await expect(drawer).toBeVisible();
  await expect(drawer.getByRole("heading", { name: "A1 Norte" })).toBeVisible();
  await expect(drawer).toContainText("A Norte");
  await expect(drawer).toContainText("Sin horario definido");
  await expect(drawer.getByTestId("preview-people")).toHaveText(/Admin A.*Encargado A1.*Región A Norte/s);
  await expect(page).toHaveURL(new RegExp(`record=${LOC_A1}`));

  await page.reload();
  await expect(page.getByTestId("preview-drawer").getByRole("heading", { name: "A1 Norte" })).toBeVisible();

  // Escape cierra y devuelve el foco; se quita ?record=.
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("preview-drawer")).toBeHidden();
  await expect(page).not.toHaveURL(/record=/);

  // Teclado: Tab hasta la fila y Enter.
  const row = page.getByTestId("locations-table-row").filter({ hasText: "A2 Norte" });
  await row.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("preview-drawer").getByRole("heading", { name: "A2 Norte" })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`record=${LOC_A2}`));
});

test("búsqueda, orden, selección y columnas visibles", async ({ page }) => {
  await signIn(page, "a_org_admin");
  await page.goto("/app/records/locations");

  await page.getByTestId("locations-table-search").fill("norte");
  expect(await firstColumn(page, "locations-table")).toEqual(["A1 Norte", "A2 Norte"]);
  await expect(page.getByTestId("locations-table-count")).toHaveText("2 de 3");
  await page.getByTestId("locations-table-search").fill("");

  const nameHeader = page.getByRole("columnheader", { name: /Nombre/ });
  await nameHeader.getByRole("button").click();
  await expect(nameHeader).toHaveAttribute("aria-sort", "ascending");
  await nameHeader.getByRole("button").click();
  await expect(nameHeader).toHaveAttribute("aria-sort", "descending");
  expect(await firstColumn(page, "locations-table")).toEqual(["A3 sin región", "A2 Norte", "A1 Norte"]);

  await page.getByRole("checkbox", { name: "Seleccionar A1 Norte" }).click();
  await page.getByRole("checkbox", { name: "Seleccionar A2 Norte" }).click();
  await expect(page.getByTestId("locations-table-selected")).toHaveText("2 seleccionadas");
  // Marcar la casilla no abre la vista previa.
  await expect(page.getByTestId("preview-drawer")).toBeHidden();
  await page.getByRole("checkbox", { name: "Seleccionar todas las filas" }).click();
  await expect(page.getByTestId("locations-table-selected")).toHaveText("3 seleccionadas");

  await expect(page.getByRole("columnheader", { name: /Zona horaria/ })).toBeVisible();
  await page.getByTestId("locations-table-columns").click();
  await page.getByRole("menuitemcheckbox", { name: "Zona horaria" }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("columnheader", { name: /Zona horaria/ })).toHaveCount(0);
});

test("el alcance filtra también las tablas de Registros", async ({ page }) => {
  await signIn(page, "a_org_admin");
  await page.goto(`/app/records/people?scope=${encodeURIComponent(`location:${LOC_A1}`)}`);
  expect(await firstColumn(page, "people-table")).toEqual(["Admin A", "Encargado A1", "Región A Norte"]);
  await page.goto(`/app/records/locations?scope=${encodeURIComponent(`location:${LOC_A1}`)}`);
  expect(await firstColumn(page, "locations-table")).toEqual(["A1 Norte"]);
});

test("?record= de algo que no está en la tabla no abre nada", async ({ page }) => {
  await signIn(page, "a_location_manager");
  await page.goto(`/app/records/locations?record=${LOC_A2}`);
  await expect(page.getByTestId("locations-table-row")).toHaveCount(1);
  await expect(page.getByTestId("preview-drawer")).toBeHidden();
  await expect(page.getByText("A2 Norte")).toHaveCount(0);
});

test("al cerrar la vista previa, el foco vuelve a la fila que la abrió", async ({ page }) => {
  await signIn(page, "a_org_admin");
  await page.goto("/app/records/people");
  const row = page.getByTestId("people-table-row").filter({ hasText: "Staff A2" });
  await row.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("preview-drawer")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("preview-drawer")).toBeHidden();
  await expect(row).toBeFocused();
});
