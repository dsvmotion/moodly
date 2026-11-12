import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./helpers";

// La bandeja de conversaciones (`/app/inbox`) con las conversaciones del seed
// de Demo A (seedInboxConversations): una abierta en A1 (la lleva el agente, por WhatsApp), una en A2
// (la lleva el equipo, con un aviso del sistema y un mensaje que no se pudo
// enviar), una cerrada en A1, una de toda la organización (solo la ve el
// org_admin) y una del chat de pruebas en A1, que nunca sale en la bandeja.
// Todo se lee con la sesión de cada persona (RLS); la app no escribe nada.

const OPEN_A1 = "Lucía Martín";
const HUMAN_A2 = "Jorge Pérez";
const CLOSED_A1 = "Marta Ruiz";
const ORG_WIDE = "Empresa Sol";
const TEST_CHAT = "Prueba interna";
// Ids fijos del seed (packages/db/src/seed/data.ts → seedInboxConversations).
const HUMAN_A2_ID = "5eed000b-0000-4000-8000-0000000000b2";
const ORG_WIDE_ID = "5eed000b-0000-4000-8000-0000000000b4";
const TEST_CHAT_ID = "5eed000b-0000-4000-8000-0000000000b5";
const REGION_A_NORTE = "5eed0001-0000-4000-8000-0000000000a1";
const LOC_A2 = "5eed0002-0000-4000-8000-0000000000a2";
const LOC_A3 = "5eed0002-0000-4000-8000-0000000000a3";
const WCAG_21_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

async function contacts(page: Page): Promise<string[]> {
  return page.getByTestId("inbox-contact").allTextContents();
}

test("el org_admin ve las abiertas de toda la organización, de la más reciente a la más antigua", async ({ page }) => {
  await signIn(page, "a_org_admin");
  await page.goto("/app/inbox");
  await expect(page.getByRole("heading", { level: 1, name: "Bandeja" })).toBeVisible();
  await expect(page.getByTestId("inbox-contact")).toHaveText([OPEN_A1, ORG_WIDE, HUMAN_A2]);
  await expect(page.getByTestId("inbox-location")).toHaveText(["A1 Norte", "Toda la organización", "A2 Norte"]);
  await expect(page.getByTestId("inbox-mode")).toHaveText(["Agente", "Agente", "Equipo"]);
  await expect(page.getByTestId("inbox-preview").first()).toHaveText("A las 18:30 perfecto");
  expect(await contacts(page)).not.toContain(TEST_CHAT);
  expect(await contacts(page)).not.toContain(CLOSED_A1);
  await expect(page.getByTestId("inbox-choose")).toBeVisible();

  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running"));
  const results = await new AxeBuilder({ page }).withTags(WCAG_21_AA).analyze();
  expect(results.violations.map((v) => v.id)).toEqual([]);
});

// El alcance elegido se filtra en la consulta (auditoría de preproducción,
// M-07). Con una región o un local no sale lo de toda la organización, que no
// es de ningún local.
test("el selector de alcance acota la lista a una región o a un local", async ({ page }) => {
  await signIn(page, "a_org_admin");
  await page.goto(`/app/inbox?scope=${encodeURIComponent(`region:${REGION_A_NORTE}`)}`);
  await expect(page.getByTestId("inbox-contact")).toHaveText([OPEN_A1, HUMAN_A2]);

  await page.goto(`/app/inbox?scope=${encodeURIComponent(`location:${LOC_A2}`)}`);
  await expect(page.getByTestId("inbox-contact")).toHaveText([HUMAN_A2]);
  // La conversación abierta desde ahí conserva el alcance; la de otro local da 404.
  await page.getByTestId("inbox-conversation").click();
  await expect(page).toHaveURL(new RegExp(`/app/inbox/${HUMAN_A2_ID}\\?scope=`));
  await expect(page.getByTestId("inbox-thread-contact")).toHaveText(HUMAN_A2);

  // Un local sin conversaciones: la lista vacía, no las de otros.
  await page.goto(`/app/inbox?scope=${encodeURIComponent(`location:${LOC_A3}`)}`);
  await expect(page.getByTestId("inbox-empty")).toBeVisible();
  await expect(page.getByTestId("inbox-conversation")).toHaveCount(0);
});

test("las pestañas separan las que lleva el equipo y las cerradas", async ({ page }) => {
  await signIn(page, "a_org_admin");
  await page.goto("/app/inbox");
  await page.getByTestId("inbox-filter").filter({ hasText: "Las lleva el equipo" }).click();
  await expect(page).toHaveURL(/\/app\/inbox\?status=human$/);
  await expect(page.getByTestId("inbox-contact")).toHaveText([HUMAN_A2]);

  await page.getByTestId("inbox-filter").filter({ hasText: "Cerradas" }).click();
  await expect(page.getByTestId("inbox-contact")).toHaveText([CLOSED_A1]);
  await expect(page.getByTestId("inbox-filter").filter({ hasText: "Cerradas" })).toHaveAttribute("aria-current", "page");
});

test("la búsqueda por nombre conserva la pestaña y no trata % como comodín", async ({ page }) => {
  await signIn(page, "a_org_admin");
  await page.goto("/app/inbox?status=closed");
  await page.getByTestId("inbox-search").fill("marta");
  await page.getByTestId("inbox-search").press("Enter");
  await expect(page).toHaveURL(/status=closed/);
  await expect(page.getByTestId("inbox-contact")).toHaveText([CLOSED_A1]);

  await page.goto("/app/inbox?q=%25");
  await expect(page.getByTestId("inbox-empty")).toContainText("Sin resultados");
});

test("una conversación se lee entera: cliente, sistema y equipo, con lo que no se pudo enviar", async ({ page }) => {
  await signIn(page, "a_org_admin");
  await page.goto("/app/inbox");
  await page.getByTestId("inbox-conversation").filter({ hasText: HUMAN_A2 }).click();
  await expect(page).toHaveURL(/\/app\/inbox\/[0-9a-f-]{36}$/);
  await expect(page.getByTestId("inbox-thread-contact")).toHaveText(HUMAN_A2);
  await expect(page.getByTestId("inbox-thread-mode")).toHaveText("La lleva el equipo");
  await expect(page.getByTestId("inbox-thread-location")).toHaveText("A2 Norte");
  const messages = page.getByTestId("inbox-message");
  await expect(messages).toHaveCount(4);
  expect(await messages.evaluateAll((items) => items.map((item) => item.getAttribute("data-author")))).toEqual([
    "contact",
    "system",
    "user",
    "user",
  ]);
  await expect(page.getByTestId("inbox-message-status")).toHaveText(["No se pudo enviar"]);
  await expect(page.getByTestId("inbox-conversation").filter({ hasText: HUMAN_A2 })).toHaveAttribute("aria-current", "page");

  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running"));
  const results = await new AxeBuilder({ page }).withTags(WCAG_21_AA).analyze();
  expect(results.violations.map((v) => v.id)).toEqual([]);
});

test("quien lleva un local solo ve lo de su local; lo de otro y el chat de pruebas dan 404", async ({ page }) => {
  await signIn(page, "a_location_manager");
  await page.goto("/app/inbox");
  await expect(page.getByTestId("inbox-contact")).toHaveText([OPEN_A1]);
  expect(await contacts(page)).not.toContain(TEST_CHAT);
  for (const id of [HUMAN_A2_ID, ORG_WIDE_ID, TEST_CHAT_ID]) {
    const response = await page.goto(`/app/inbox/${id}`);
    expect(response?.status()).toBe(404);
  }
});

test("el equipo de A2 ve la suya y la abre", async ({ page }) => {
  await signIn(page, "a_staff");
  await page.goto("/app/inbox");
  await expect(page.getByTestId("inbox-contact")).toHaveText([HUMAN_A2]);
  const response = await page.goto(`/app/inbox/${HUMAN_A2_ID}`);
  expect(response?.status()).toBe(200);
  await expect(page.getByTestId("inbox-thread-contact")).toHaveText(HUMAN_A2);
});

test("otra organización no ve nada, ni por su id; un id inventado da 404", async ({ page }) => {
  await signIn(page, "b_org_admin");
  await page.goto("/app/inbox");
  await expect(page.getByTestId("inbox-empty")).toBeVisible();
  for (const path of [`/app/inbox/${HUMAN_A2_ID}`, "/app/inbox/no-es-un-id", "/app/inbox/00000000-0000-4000-8000-000000000000"]) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(404);
  }
});

test("en el móvil se ve una cosa cada vez: la conversación, con un enlace para volver", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, "a_staff");
  await page.goto("/app/inbox");
  await expect(page.getByTestId("inbox-list")).toBeVisible();
  await page.getByTestId("inbox-conversation").filter({ hasText: HUMAN_A2 }).click();
  await expect(page.getByTestId("inbox-thread")).toBeVisible();
  await expect(page.getByTestId("inbox-list")).toBeHidden();
  await page.getByTestId("inbox-back").click();
  await expect(page).toHaveURL(/\/app\/inbox$/);
  await expect(page.getByTestId("inbox-list")).toBeVisible();
});
