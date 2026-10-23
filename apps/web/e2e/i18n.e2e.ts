import { expect, test } from "@playwright/test";
import { openUserMenu, signIn } from "./helpers";

// i18n (MANUAL §9.9): español por defecto e inglés, elegido por el usuario y
// recordado en una cookie.
test("español por defecto; se cambia a inglés, se recuerda y se vuelve al español", async ({ page }) => {
  await signIn(page, "a_org_admin");
  await page.goto("/app/ajustes/general");
  const html = page.locator("html");
  const sidebar = page.getByRole("navigation", { name: "Navegación principal" });
  await expect(html).toHaveAttribute("lang", "es");
  await expect(sidebar.getByRole("link", { name: "Bandeja", exact: true })).toBeVisible();

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

  await page.goto("/app/ajustes/sedes");
  await expect(page.getByRole("columnheader", { name: /Time zone/ })).toBeVisible();
  await expect(page.getByTestId("locations-table-count")).toHaveText("3 of 3");

  await openUserMenu(page);
  await page.getByTestId("language-switcher").getByRole("menuitemradio", { name: "Español" }).click();
  await expect(html).toHaveAttribute("lang", "es");
  await expect(page.getByRole("columnheader", { name: /Zona horaria/ })).toBeVisible();
});

test("un idioma no soportado en la cookie cae al español", async ({ page, context }) => {
  await context.addCookies([{ name: "locale", value: "fr", url: "http://127.0.0.1:3000" }]);
  await signIn(page, "a_staff");
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await expect(page.getByRole("navigation", { name: "Navegación principal" })).toBeVisible();
});
