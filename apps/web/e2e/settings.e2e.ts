import { expect, test } from "@playwright/test";
import { credentialsFor, signIn } from "./helpers";

// Ajustes como área propia (P6, MANUAL §9.4; auditoría del frontend, F-3):
// navegación secundaria agrupada, secciones con datos reales y, las que aún no
// tienen contenido, un vacío que dice qué habrá y con qué llega.
const SECTIONS = [
  "Mi perfil", "Preferencias", "Privacidad",
  "Miembros", "Roles",
  "General", "Sedes", "Plan y consumo", "Facturación",
  "Modelos de IA", "Integraciones",
  "Seguridad y acceso", "Registro de auditoría",
];
const PENDING = [
  ["privacy", "Privacidad"],
  ["roles", "Roles"],
  ["plan", "Plan y consumo"],
  ["billing", "Facturación"],
  ["models", "Modelos de IA"],
  ["audit", "Registro de auditoría"],
] as const;

test.describe("Ajustes", () => {
  test.beforeEach(async ({ page }) => signIn(page, "a_org_admin"));

  test("navegación secundaria con las 13 secciones, una sola activa y migas", async ({ page }) => {
    await page.goto("/app/settings");
    await expect(page).toHaveURL(/\/app\/settings\/general$/);
    const nav = page.getByTestId("settings-nav");
    for (const name of SECTIONS) await expect(nav.getByRole("link", { name, exact: true })).toBeVisible();
    await expect(nav.getByRole("link")).toHaveCount(SECTIONS.length);
    await expect(nav.locator('[aria-current="page"]')).toHaveText(["General"]);
    await expect(page.getByTestId("breadcrumbs")).toHaveText("Ajustes/General");

    await nav.getByRole("link", { name: "Sedes", exact: true }).click();
    await expect(page).toHaveURL(/\/app\/settings\/locations$/);
    await expect(nav.locator('[aria-current="page"]')).toHaveText(["Sedes"]);
    await expect(page.getByTestId("breadcrumbs")).toHaveText("Ajustes/Sedes");
    // La entrada «Ajustes» de la barra lateral sigue activa en cualquier sección.
    const sidebar = page.getByRole("navigation", { name: "Navegación principal" });
    await expect(sidebar.getByRole("link", { name: "Ajustes", exact: true })).toHaveAttribute("aria-current", "page");
  });

  test("las secciones pendientes dicen qué habrá y con qué llega; una inventada no existe", async ({ page }) => {
    for (const [slug, title] of PENDING) {
      await page.goto(`/app/settings/${slug}`);
      await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
      await expect(page.getByTestId("settings-pending")).toHaveText("Aún no disponible");
      await expect(page.getByTestId("settings-empty")).toContainText("Llega con");
    }
    const response = await page.goto("/app/settings/api");
    expect(response?.status()).toBe(404);
  });

  test("Mi perfil muestra su nombre, email, MFA y su rol en la organización", async ({ page }) => {
    await page.goto("/app/settings/profile");
    await expect(page.getByRole("heading", { level: 1, name: "Mi perfil" })).toBeVisible();
    await expect(page.getByTestId("profile-name")).toHaveText("Admin A");
    await expect(page.getByTestId("profile-email")).toHaveText(credentialsFor("a_org_admin").email);
    await expect(page.getByTestId("profile-mfa")).toHaveText("Activada");
    await expect(page.getByTestId("profile-membership")).toHaveText(["Demo AAdministración"]);
  });

  test("Preferencias: el tema y el idioma se aplican al elegir y se recuerdan", async ({ page }) => {
    const html = page.locator("html");
    await page.goto("/app/settings/preferences");
    await page.getByTestId("preferences-theme").getByRole("radio", { name: "Oscuro" }).check();
    await expect(html).toHaveAttribute("data-theme", "dark");
    await page.reload();
    await expect(html).toHaveAttribute("data-theme", "dark");
    await expect(page.getByTestId("preferences-theme").getByRole("radio", { name: "Oscuro" })).toBeChecked();

    await page.getByTestId("preferences-language").getByRole("radio", { name: "English" }).check();
    await expect(html).toHaveAttribute("lang", "en");
    await expect(page.getByRole("heading", { level: 1, name: "Preferences" })).toBeVisible();
    await page.getByTestId("preferences-language").getByRole("radio", { name: "Español" }).check();
    await expect(html).toHaveAttribute("lang", "es");
    await page.getByTestId("preferences-theme").getByRole("radio", { name: "Sistema" }).check();
    await expect(html).not.toHaveAttribute("data-theme", /.+/);
  });
});

test("quien está en dos organizaciones ve las dos en su perfil, con su rol", async ({ page }) => {
  await signIn(page, "de_staff");
  await page.goto("/app/settings/profile");
  await expect(page.getByTestId("profile-membership")).toHaveText(["Demo DPersonal", "Demo EPersonal"]);
  await expect(page.getByTestId("profile-mfa")).toHaveText("Desactivada");
});
