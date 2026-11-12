import AxeBuilder from "@axe-core/playwright";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
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

type SessionState = Awaited<ReturnType<BrowserContext["storageState"]>>;

// Un test por pantalla y tema: con todas en un test (y luego de cuatro en
// cuatro) cada uno rozaba o pasaba su límite de 30 s con la máquina cargada,
// y fallaba por tiempo, no por accesibilidad. Para que cada test sea una sola
// navegación y un análisis de axe, a_org_admin entra (contraseña y código) una
// vez por worker y cada test abre su propio contexto con esa sesión aal2.
// Ningún e2e cierra todas las sesiones de a_org_admin: el logout es «local».
const adminTest = test.extend<Record<never, never>, { adminSession: SessionState }>({
  adminSession: [
    async ({ browser }, provide, workerInfo) => {
      const { baseURL } = workerInfo.project.use;
      const context = await browser.newContext(baseURL ? { baseURL } : {});
      await signIn(await context.newPage(), "a_org_admin");
      const session = await context.storageState();
      await context.close();
      await provide(session);
    },
    { scope: "worker" },
  ],
  storageState: async ({ adminSession }, provide) => provide(adminSession),
});

const SCREENS = [
  "/app",
  "/app/settings/general",
  "/app/settings/security",
  "/app/inbox",
  "/app/settings/locations",
  "/app/settings/team",
  "/app/agents",
  "/app/agents/reception",
  "/app/settings/profile",
  "/app/settings/preferences",
  "/app/settings/roles",
];

// Menús, paneles y paleta abiertos sobre Sedes, también uno por test.
const mainNav = (page: Page) => page.getByRole("navigation", { name: "Navegación principal" });
const OPEN_STATES: { where: string; open: (page: Page) => Promise<void> }[] = [
  {
    where: "vista previa",
    open: async (page) => {
      await page.getByTestId("locations-table-row").first().click();
      await expect(page.getByTestId("preview-drawer")).toBeVisible();
    },
  },
  {
    where: "selector de alcance",
    open: async (page) => {
      await page.getByTestId("scope-switcher").click();
      await expect(page.getByTestId("scope-options")).toBeVisible();
    },
  },
  {
    where: "menú de usuario",
    open: async (page) => {
      await page.getByTestId("user-menu").click();
      await expect(page.getByTestId("user-menu-content")).toBeVisible();
    },
  },
  {
    where: "paleta de comandos",
    open: async (page) => {
      await page.keyboard.press("ControlOrMeta+k");
      await expect(page.getByRole("dialog", { name: "Paleta de comandos" })).toBeVisible();
    },
  },
  {
    where: "barra lateral compacta",
    open: async (page) => {
      await page.getByRole("button", { name: "Compactar barra lateral" }).click();
      await expect(mainNav(page)).toHaveAttribute("data-collapsed", "true");
    },
  },
];

for (const theme of ["light", "dark"] as const) {
  adminTest.describe(`tema ${theme}`, () => {
    adminTest.beforeEach(async ({ context }) => {
      await context.addCookies([{ name: "theme", value: theme, url: "http://127.0.0.1:3000" }]);
    });

    for (const path of SCREENS) {
      adminTest(`pantalla ${path}`, async ({ page }) => {
        await page.goto(path);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await expectNoViolations(page, path);
      });
    }

    for (const { where, open } of OPEN_STATES) {
      adminTest(`menús, paneles y paleta abiertos: ${where}`, async ({ page }) => {
        await page.goto("/app/settings/locations");
        // Hasta que React hidrata, ni los botones ni el atajo ⌘K responden
        // (como en sidebar.e2e.ts): un clic temprano se perdería.
        await expect(mainNav(page)).toHaveAttribute("data-hydrated", "true");
        await open(page);
        await expectNoViolations(page, where);
      });
    }
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
