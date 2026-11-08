import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { apiToken, restRows, signIn } from "./helpers";

// El chat de pruebas de un agente (paso 4d-3e). En el e2e no hay worker: se
// comprueba que el mensaje entra, con la sesión de quien escribe, en su
// conversación de prueba del local, que la pantalla espera al agente y que
// empezar de nuevo la cierra. Que el agente conteste en ese canal (también en
// draft) lo prueba la integración del worker; quién puede escribir, el pgTAP
// 29_test_chat.
test.describe.configure({ mode: "serial" });

const QUESTION = "¿Tenéis hueco el lunes por la mañana?";
const WCAG_21_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const byContent = `messages?select=author,direction,content&content=eq.${encodeURIComponent(QUESTION)}&order=created_at.desc&limit=1`;

test("el equipo de un local escribe al agente como un cliente y la pantalla espera su respuesta", async ({ page, request }) => {
  await signIn(page, "a_staff");
  await page.goto("/app/agents/reception");
  const chat = page.getByTestId("test-chat");
  await expect(chat.getByRole("heading", { level: 2, name: "Pruébalo" })).toBeVisible();
  await expect(chat.getByTestId("test-chat-location")).toHaveText("En A2 Norte");
  await expect(chat.getByTestId("test-chat-warning")).toContainText("Lo que apruebes aquí es real");
  // Una ejecución anterior en la misma base de datos puede haber dejado su conversación.
  if (await chat.getByTestId("test-chat-restart").isVisible()) {
    await chat.getByTestId("test-chat-restart").click();
    await expect(chat.getByTestId("test-chat-empty")).toBeVisible();
  }

  await chat.getByTestId("test-chat-input").fill(`  ${QUESTION}  `);
  await chat.getByTestId("test-chat-send").click();
  await expect(chat.getByTestId("test-chat-mine")).toHaveText([QUESTION]);
  await expect(chat.getByTestId("test-chat-waiting")).toHaveText("Recepción está contestando…");
  await expect(chat.getByTestId("test-chat-input")).toHaveValue("");

  // Lo que quedó en la base de datos, leído con su sesión (RLS): un mensaje de
  // entrada de su contacto de prueba, sin los espacios.
  const token = await apiToken(request, "a_staff");
  expect(await restRows(request, token, byContent)).toEqual([{ author: "contact", direction: "in", content: QUESTION }]);

  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running"));
  const results = await new AxeBuilder({ page }).include('[data-testid="test-chat"]').withTags(WCAG_21_AA).analyze();
  expect(results.violations.map((v) => v.id)).toEqual([]);
});

test("otra organización no ve la conversación de prueba", async ({ request }) => {
  const token = await apiToken(request, "b_org_admin");
  expect(await restRows(request, token, byContent)).toEqual([]);
});

test("empezar de nuevo cierra la conversación: la siguiente empieza sin historial", async ({ page }) => {
  await signIn(page, "a_staff");
  await page.goto("/app/agents/reception");
  const chat = page.getByTestId("test-chat");
  await expect(chat.getByTestId("test-chat-mine")).toHaveText([QUESTION]);
  await chat.getByTestId("test-chat-restart").click();
  await expect(chat.getByTestId("test-chat-empty")).toBeVisible();
  await expect(chat.getByTestId("test-chat-mine")).toHaveCount(0);
  await expect(chat.getByTestId("test-chat-restart")).toHaveCount(0);
});

test("un mensaje vacío no se envía", async ({ page }) => {
  await signIn(page, "a_staff");
  await page.goto("/app/agents/reception");
  const chat = page.getByTestId("test-chat");
  await chat.getByTestId("test-chat-input").fill("   ");
  await chat.getByTestId("test-chat-send").click();
  await expect(chat.getByTestId("test-chat-error")).toHaveText("Escribe un mensaje de hasta 2000 caracteres.");
  await expect(chat.getByTestId("test-chat-empty")).toBeVisible();
});
