import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

// Estados de carga y avisos de la app (auditoría de preproducción, M-10): al
// navegar entre secciones, mientras llega la nueva, se ve su forma y el lector
// de pantalla oye «Cargando la página»; y la región de avisos (toasts) está
// montada, con su nombre traducido.

test("mientras llega una sección, se ve su estado de carga", async ({ page }) => {
  await signIn(page, "a_staff");
  await page.goto("/app");
  await expect(page.getByRole("navigation", { name: "Navegación principal" })).toHaveAttribute("data-hydrated", "true");

  // Una conexión lenta: la respuesta de la sección llega a trozos, y el primero
  // trae el estado de carga (el Suspense de loading.tsx) antes que la página.
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 400,
    downloadThroughput: 8 * 1024,
    uploadThroughput: 8 * 1024,
  });
  await page.getByRole("navigation", { name: "Navegación principal" }).getByRole("link", { name: "Objetivos", exact: true }).click();
  // Si la precarga del enlace no había terminado, el primer trozo (que siempre
  // trae la carga antes que la página) tarda más con esta conexión: con la
  // suite entera en paralelo, más de los 5 s de por defecto.
  await expect(page.getByRole("status", { name: "Cargando la página" })).toBeVisible({ timeout: 20_000 });
  // Vista la carga, la conexión vuelve a ir bien y llega la sección.
  await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  await expect(page.getByRole("heading", { level: 1, name: "Objetivos" })).toBeVisible();
  await expect(page.getByTestId("app-loading")).toHaveCount(0);
});

test("la región de avisos está montada y se llama en el idioma de la persona", async ({ page }) => {
  await signIn(page, "a_staff");
  await page.goto("/app");
  await expect(page.getByRole("region", { name: "Avisos (F8)" })).toBeAttached();
});
