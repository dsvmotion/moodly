import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

// Estados de carga y avisos de la app (auditoría de preproducción, M-10): al
// navegar entre secciones, mientras llega la nueva, se ve su forma y el lector
// de pantalla oye «Cargando la página»; y la región de avisos (toasts) está
// montada, con su nombre traducido.

/** Las peticiones RSC de la sección de Objetivos (navegación y precargas), no sus recursos. */
const GOALS_RSC = /\/app\/goals\?(.*&)?_rsc=/;

test("mientras llega una sección, se ve su estado de carga", async ({ page }) => {
  await signIn(page, "a_staff");
  await page.goto("/app");
  const nav = page.getByRole("navigation", { name: "Navegación principal" });
  await expect(nav).toHaveAttribute("data-hydrated", "true");

  // El estado de carga sale de la precarga del enlace (el árbol de la ruta y su
  // loading.tsx), y la sección, de la petición de la navegación. Sin control,
  // la prueba dependía de quién llegaba antes (#264 la frenaba con una conexión
  // lenta y fallaba a veces): si la navegación empezaba sin la precarga, Next
  // esperaba a su respuesta y no enseñaba la carga.
  // - Las precargas llegan enteras (route.fetch + fulfill) y se espera a
  //   haberlas entregado antes de pulsar. (Del lado del navegador no hay señal
  //   fiable: Next lee lo que necesita y corta la petición.)
  // - La navegación se retiene hasta haber visto la carga: mientras, la sección
  //   no puede llegar.
  const prefetches = { started: 0, finished: 0, route: false };
  let releaseNavigation!: () => void;
  const navigationGate = new Promise<void>((resolve) => (releaseNavigation = resolve));
  let navigations = 0;
  await page.route(GOALS_RSC, async (route) => {
    const headers = route.request().headers();
    if (headers["next-router-prefetch"]) {
      prefetches.started++;
      await route.fulfill({ response: await route.fetch() });
      prefetches.finished++;
      // La de la ruta (sin cabecera de segmento) es la que trae loading.tsx; la
      // de «/_tree», que va antes, solo el árbol.
      if (!headers["next-router-segment-prefetch"]) prefetches.route = true;
      return;
    }
    navigations++;
    await navigationGate;
    await route.continue();
  });

  const link = nav.getByRole("link", { name: "Objetivos", exact: true });
  await link.hover();
  await expect.poll(() => prefetches.route && prefetches.finished === prefetches.started).toBe(true);
  // Que la app procese lo recibido (unas pocas tareas) antes de pulsar.
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve))));

  await link.click();
  await expect(page.getByRole("status", { name: "Cargando la página" })).toBeVisible();
  await expect.poll(() => navigations).toBe(1);

  // Vista la carga, llega la sección y la carga desaparece.
  releaseNavigation();
  await expect(page.getByRole("heading", { level: 1, name: "Objetivos" })).toBeVisible();
  await expect(page.getByTestId("app-loading")).toHaveCount(0);
});

test("la región de avisos está montada y se llama en el idioma de la persona", async ({ page }) => {
  await signIn(page, "a_staff");
  await page.goto("/app");
  await expect(page.getByRole("region", { name: "Avisos (F8)" })).toBeAttached();
});
