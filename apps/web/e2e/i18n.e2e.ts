import { expect, test } from "@playwright/test";
import { openUserMenu, signIn } from "./helpers";

// i18n (MANUAL §9.9, ADR 0041): el idioma que elige la persona (cookie); si no ha
// elegido, el de su organización activa; y sin sesión ni organización, inglés.
test("sin elegir: login en inglés y la app en el idioma de la organización; lo elegido gana y se recuerda", async ({ page }) => {
  await page.goto("/login");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await signIn(page, "a_org_admin");
  await page.goto("/app/settings/general");
  const html = page.locator("html");
  const sidebar = page.getByRole("navigation", { name: "Navegación principal" });
  await expect(html).toHaveAttribute("lang", "es");
  await expect(sidebar.getByRole("link", { name: "Bandeja", exact: true })).toBeVisible();

  // Demo A está en español; la persona elige inglés y desde entonces manda lo suyo.
  await openUserMenu(page);
  await page.getByTestId("language-switcher").getByRole("menuitemradio", { name: "English" }).click();
  await expect(html).toHaveAttribute("lang", "en");
  const sidebarEn = page.getByRole("navigation", { name: "Main navigation" });
  await expect(sidebarEn.getByRole("link", { name: "Inbox", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "My organization" })).toBeVisible();
  await expect(page.getByTestId("scope-switcher")).toContainText("Whole organization");

  await page.reload();
  await expect(html).toHaveAttribute("lang", "en");
  await sidebarEn.getByRole("link", { name: "Inbox", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Inbox" })).toBeVisible();
  await expect(page.getByTestId("section-empty")).toContainText("once you connect a channel");

  await page.goto("/app/settings/locations");
  await expect(page.getByRole("columnheader", { name: /Time zone/ })).toBeVisible();
  await expect(page.getByTestId("locations-table-count")).toHaveText("3 of 3");

  await openUserMenu(page);
  await page.getByTestId("language-switcher").getByRole("menuitemradio", { name: "Español" }).click();
  await expect(html).toHaveAttribute("lang", "es");
  await expect(page.getByRole("columnheader", { name: /Zona horaria/ })).toBeVisible();
});

test("un idioma no soportado en la cookie no cuenta: inglés sin sesión y, dentro, el de la organización", async ({ page, context }) => {
  await context.addCookies([{ name: "locale", value: "fr", url: "http://127.0.0.1:3000" }]);
  await page.goto("/login");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await signIn(page, "a_staff");
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await expect(page.getByRole("navigation", { name: "Navegación principal" })).toBeVisible();
});
