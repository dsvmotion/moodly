import { expect, test, type Browser, type Page } from "@playwright/test";
import { signIn } from "./helpers";

// La bandeja en vivo (auditoría M-10, ADR 0054): el servidor de la app escucha
// los avisos privados de Realtime de la bandeja de cada persona (#216) y los
// reenvía al navegador por Server-Sent Events (/app/inbox/events), solo con
// identificadores. Para no tocar las conversaciones que comprueban otros
// tests, el aviso sale de un mensaje del chat de pruebas: el responsable de A1
// escribe en el suyo, que es una conversación de A1 (tema inbox:<A>:<A1>).
// La relectura periódica es de 60 s: lo que llega en unos segundos es Realtime.
test.describe.configure({ mode: "serial" });

const LIVE_TIMEOUT = 15_000;

async function openInbox(browser: Browser, key: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await signIn(page, key);
  await page.goto("/app/inbox");
  await expect(page.getByTestId("inbox-live")).toHaveAttribute("data-status", "open", { timeout: LIVE_TIMEOUT });
  return page;
}

async function writeInA1TestChat(browser: Browser): Promise<void> {
  const page = await (await browser.newContext()).newPage();
  await signIn(page, "a_location_manager");
  await page.goto("/app/agents/reception");
  const chat = page.getByTestId("test-chat");
  await expect(chat.getByTestId("test-chat-location")).toHaveText("En A1 Norte");
  await chat.getByTestId("test-chat-input").fill(`¿Abrís el sábado? ${Date.now().toString(36)}`);
  await chat.getByTestId("test-chat-send").click();
  await expect(chat.getByTestId("test-chat-waiting")).toBeVisible();
  await page.close();
}

const received = (page: Page) => page.getByTestId("inbox-live");

test("un mensaje de A1 llega al momento a quien ve A1, y no a quien lleva otro local", async ({ browser }) => {
  const region = await openInbox(browser, "a_region_manager"); // A Norte: A1 y A2
  const otherLocation = await openInbox(browser, "a_staff"); // solo A2
  await expect(received(region)).toHaveAttribute("data-received", "0");

  await writeInA1TestChat(browser);

  // Llega a quien ve A1, en segundos (antes de la relectura de 60 s).
  await expect(received(region)).not.toHaveAttribute("data-received", "0", { timeout: LIVE_TIMEOUT });
  // Y a quien lleva A2 no le llega nada: ni se suscribe a A1 (el tema sale de su
  // alcance en el servidor) ni Realtime le dejaría unirse (política inbox_read).
  await region.waitForTimeout(2_000);
  await expect(received(otherLocation)).toHaveAttribute("data-received", "0");
  await expect(received(otherLocation)).toHaveAttribute("data-status", "open");
});

test("con la pestaña oculta no hay conexión; al volver, se abre otra", async ({ browser }) => {
  const page = await openInbox(browser, "a_region_manager");
  const setVisibility = (state: "hidden" | "visible") =>
    page.evaluate((value) => {
      Object.defineProperty(document, "visibilityState", { value, configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
    }, state);

  await setVisibility("hidden");
  await expect(received(page)).toHaveAttribute("data-status", "closed");
  await setVisibility("visible");
  await expect(received(page)).toHaveAttribute("data-status", "open", { timeout: LIVE_TIMEOUT });
});

test("sin sesión, el relé no abre ninguna conexión", async ({ request }) => {
  const response = await request.get("/app/inbox/events", { maxRedirects: 0 });
  expect(response.status()).not.toBe(200);
  expect(response.headers()["content-type"] ?? "").not.toContain("text/event-stream");
});
