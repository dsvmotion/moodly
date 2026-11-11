import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./helpers";

// La bandeja con más conversaciones de las que caben en una página (auditoría
// de preproducción, M-07), con la organización de volumen del seed (Demo F):
// 105 abiertas y 105 cerradas sin mensajes en F1, y una de F2 («Contacto de
// F2», la lleva el equipo) más antigua que todas las abiertas de F1.
// - El local elegido se filtra en la consulta: lo de F2 sale aunque las 100
//   más recientes de la organización sean de F1.
// - La lista se pagina por posición: 100 por página, sin repetir ni saltarse
//   ninguna, también entre conversaciones sin mensajes.

const PAGE_SIZE = 100;
const CONTACT_F2 = "Contacto de F2";
// Id fijo del seed (packages/db/src/seed/data.ts).
const LOC_F2 = "5eed0002-0000-4000-8000-0000000000f2";

async function conversationIds(page: Page): Promise<string[]> {
  return page
    .getByTestId("inbox-conversation")
    .evaluateAll((rows) => rows.map((row) => row.getAttribute("data-conversation-id") ?? ""));
}

/** Todas las páginas de la pestaña abierta, siguiendo «Ver conversaciones anteriores». */
async function allPages(page: Page): Promise<string[][]> {
  const pages = [await conversationIds(page)];
  while ((await page.getByTestId("inbox-older").count()) > 0) {
    const before = page.url();
    await page.getByTestId("inbox-older").click();
    await expect(page).not.toHaveURL(before);
    await expect(page.getByTestId("inbox-newest")).toBeVisible();
    pages.push(await conversationIds(page));
  }
  return pages;
}

test("con un local elegido salen sus conversaciones, aunque otras cien de la organización sean más recientes", async ({
  page,
}) => {
  await signIn(page, "f_org_admin");
  await page.goto(`/app/inbox?scope=${encodeURIComponent(`location:${LOC_F2}`)}`);
  await expect(page.getByTestId("inbox-contact")).toHaveText([CONTACT_F2]);
  await expect(page.getByTestId("inbox-older")).toHaveCount(0);
});

test("las abiertas se paginan de cien en cien, sin repetir ni saltarse ninguna", async ({ page }) => {
  await signIn(page, "f_org_admin");
  await page.goto("/app/inbox");
  await expect(page.getByTestId("inbox-conversation")).toHaveCount(PAGE_SIZE);
  await expect(page.getByTestId("inbox-newest")).toHaveCount(0);
  const pages = await allPages(page);

  expect(pages.map((ids) => ids.length)).toEqual([PAGE_SIZE, 6]);
  const all = pages.flat();
  expect(new Set(all).size).toBe(all.length);
  // La de F2 es la más antigua de las abiertas: la última de la última página.
  await expect(page.getByTestId("inbox-contact").last()).toHaveText(CONTACT_F2);

  // Abrir una conversación desde la segunda página no cambia de página.
  await page.getByTestId("inbox-conversation").first().click();
  await expect(page).toHaveURL(/\/app\/inbox\/[0-9a-f-]+\?.*before=/);
  expect(await conversationIds(page)).toEqual(pages[1]);

  // Y se vuelve al principio.
  await page.getByTestId("inbox-newest").click();
  await expect(page).not.toHaveURL(/before=/);
  await expect(page.getByTestId("inbox-conversation")).toHaveCount(PAGE_SIZE);
  expect(await conversationIds(page)).toEqual(pages[0]);
});

test("las cerradas sin mensajes también se paginan sin repetir ni saltarse ninguna", async ({ page }) => {
  await signIn(page, "f_org_admin");
  await page.goto("/app/inbox?status=closed");
  await expect(page.getByTestId("inbox-conversation")).toHaveCount(PAGE_SIZE);
  const pages = await allPages(page);
  expect(pages.map((ids) => ids.length)).toEqual([PAGE_SIZE, 5]);
  const all = pages.flat();
  expect(new Set(all).size).toBe(all.length);
});

test("cambiar de pestaña vuelve a la primera página", async ({ page }) => {
  await signIn(page, "f_org_admin");
  await page.goto("/app/inbox");
  await page.getByTestId("inbox-older").click();
  await expect(page).toHaveURL(/[?&]before=/);
  await page.getByTestId("inbox-filter").filter({ hasText: "Las lleva el equipo" }).click();
  await expect(page).toHaveURL(/status=human/);
  await expect(page).not.toHaveURL(/before=/);
  await expect(page.getByTestId("inbox-contact")).toHaveText([CONTACT_F2]);
});

test("un cursor que no lo es deja la lista en la primera página", async ({ page }) => {
  await signIn(page, "f_org_admin");
  await page.goto(`/app/inbox?before=${encodeURIComponent("ayer),id.neq.x")}`);
  await expect(page.getByTestId("inbox-conversation")).toHaveCount(PAGE_SIZE);
  await expect(page.getByTestId("inbox-newest")).toHaveCount(0);
});
