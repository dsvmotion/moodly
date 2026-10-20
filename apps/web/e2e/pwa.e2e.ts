import { BRAND_NAME } from "@repo/config";
import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./helpers";

// PWA (Fase 0): instalable desde /login sin sesión, sin datos en caché y con
// página sin conexión. Corre contra el build de producción, con el SW activo.

/** Espera a que el SW esté activo y controle la página. */
async function waitForServiceWorker(page: Page) {
  await page.evaluate(() => navigator.serviceWorker.ready);
  if (!(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)))) await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
}

/** Rutas de todo lo guardado en Cache Storage. */
async function cachedPaths(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    const paths: string[] = [];
    for (const name of await caches.keys()) {
      const cache = await caches.open(name);
      for (const request of await cache.keys()) paths.push(new URL(request.url).pathname);
    }
    return paths;
  });
}

test("sin sesión, los archivos de la PWA se sirven sin redirigir al login", async ({ request }) => {
  const sw = await request.get("/sw.js", { maxRedirects: 0 });
  expect(sw.status()).toBe(200);
  expect(sw.headers()["cache-control"]).toContain("no-cache");
  expect(sw.headers()["service-worker-allowed"]).toBe("/");

  const manifest = await request.get("/manifest.webmanifest", { maxRedirects: 0 });
  expect(manifest.status()).toBe(200);
  expect((await manifest.json()).name).toBe(BRAND_NAME);

  expect((await request.get("/offline.html", { maxRedirects: 0 })).status()).toBe(200);
  for (const icon of ["/icons/apple-touch-icon.png", "/icons/icon-512.png"]) {
    const response = await request.get(icon, { maxRedirects: 0 });
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toBe("image/png");
  }
});

test("el login enlaza el manifest y registra el service worker", async ({ page }) => {
  await page.goto("/login");
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", "/manifest.webmanifest");
  const scriptURL = await page.evaluate(async () => (await navigator.serviceWorker.ready).active?.scriptURL);
  expect(scriptURL).toMatch(/\/sw\.js$/);
});

test("tras usar la app con sesión no queda ninguna página en caché, y sin conexión se ve el aviso", async ({
  page,
}) => {
  await signIn(page, "a_org_admin");
  await page.goto("/app/settings/organization");
  await waitForServiceWorker(page);
  // Una navegación ya controlada por el SW: es la que podría acabar en caché.
  await page.reload();
  await expect(page.getByTestId("current-user")).toBeVisible();

  const paths = await cachedPaths(page);
  expect(paths).toContain("/offline.html");
  expect(paths.filter((path) => path.startsWith("/app") || path.startsWith("/login"))).toEqual([]);

  await page.context().setOffline(true);
  await page.goto("/app/settings/organization");
  await expect(page.getByRole("heading", { name: "Sin conexión" })).toBeVisible();

  // Al volver la conexión, "Reintentar" carga la página que se pedía.
  await page.context().setOffline(false);
  await page.getByRole("link", { name: "Reintentar" }).click();
  await expect(page).toHaveURL(/\/app\/settings\/organization$/);
  await expect(page.getByTestId("current-user")).toBeVisible();
});
