import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

// Tomar el control de una conversación, escribir como equipo y devolverla al
// agente, con la conversación de C1 del seed (seedInboxConversations →
// c1_takeover), que nadie más usa: así no cambia lo que ven las pruebas de solo
// lectura de inbox.e2e.ts, que van en paralelo. La barrera es la base de datos
// (RLS, guard_conversation_mode y guard_staff_message, migración
// 20261109230000_inbox_takeover, con sus pgTAP); aquí se prueba el flujo de la
// pantalla con un org_admin con MFA (aal2). Van en orden y la última la deja
// otra vez en manos del agente: el seed la vuelve a crear en cada ejecución.
test.describe.configure({ mode: "serial" });

const TAKEOVER_ID = "5eed000b-0000-4000-8000-0000000000b6";
const CONTACT = "Sara Gil";
const WCAG_21_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

test("tomar el control pide confirmación, y cancelar no cambia nada", async ({ page }) => {
  await signIn(page, "c_org_admin");
  await page.goto(`/app/inbox/${TAKEOVER_ID}`);
  await expect(page.getByTestId("inbox-thread-contact")).toHaveText(CONTACT);
  await expect(page.getByTestId("inbox-thread-mode")).toHaveText("La lleva el agente");
  await expect(page.getByTestId("inbox-composer-hint")).toBeVisible();
  await expect(page.getByTestId("inbox-composer")).toHaveCount(0);

  await page.getByTestId("inbox-take-over").click();
  const dialog = page.getByRole("alertdialog", { name: "¿Tomar el control de esta conversación?" });
  await expect(dialog).toContainText(`El agente dejará de responder a ${CONTACT}`);
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running"));
  const results = await new AxeBuilder({ page }).withTags(WCAG_21_AA).analyze();
  expect(results.violations.map((v) => v.id)).toEqual([]);

  await dialog.getByRole("button", { name: "Cancelar" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByTestId("inbox-take-over")).toBeFocused();
  await page.reload();
  await expect(page.getByTestId("inbox-thread-mode")).toHaveText("La lleva el agente");
});

test("al tomar el control, el equipo escribe al cliente; al devolverla, deja de poder", async ({ page }) => {
  await signIn(page, "c_org_admin");
  await page.goto(`/app/inbox/${TAKEOVER_ID}`);
  await page.getByTestId("inbox-take-over").click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Sí, tomo el control" }).click();
  await expect(page.getByTestId("inbox-thread-mode")).toHaveText("La lleva el equipo");
  await expect(page.getByTestId("inbox-give-back")).toBeVisible();
  // Mientras la lleva una persona, sale en la pestaña del equipo.
  await page.goto("/app/inbox?status=human");
  await expect(page.getByTestId("inbox-contact")).toHaveText([CONTACT]);
  await page.goto(`/app/inbox/${TAKEOVER_ID}`);

  // Un mensaje vacío no sale (el navegador lo frena: el campo es obligatorio).
  await page.getByTestId("inbox-composer-send").click();
  await expect(page.getByTestId("inbox-message")).toHaveCount(2);

  const text = `Hola Sara, soy del equipo. El viernes a las 10:00 te va bien? (${Date.now()})`;
  await page.getByTestId("inbox-composer-input").fill(text);
  await page.getByTestId("inbox-composer-send").click();
  const mine = page.getByTestId("inbox-message").filter({ hasText: text });
  await expect(mine).toHaveAttribute("data-author", "user");
  // En el chat web el mensaje queda enviado al escribirlo (lo lee de la fila): sin aviso de «aún sin enviar».
  await expect(mine.getByTestId("inbox-message-status")).toHaveCount(0);
  await expect(page.getByTestId("inbox-composer-input")).toHaveValue("");

  // Sigue ahí al volver a cargar, y es lo último de la conversación en la lista.
  await page.reload();
  await expect(page.getByTestId("inbox-message").last()).toContainText(text);
  await expect(page.getByTestId("inbox-conversation").filter({ hasText: CONTACT }).getByTestId("inbox-preview")).toContainText(
    "Equipo: Hola Sara",
  );

  await page.getByTestId("inbox-give-back").click();
  await expect(page.getByTestId("inbox-thread-mode")).toHaveText("La lleva el agente");
  await expect(page.getByTestId("inbox-composer")).toHaveCount(0);
  await expect(page.getByTestId("inbox-take-over")).toBeVisible();
});

test("devuelta al agente, sale de la pestaña del equipo; y otra organización no la ve", async ({ browser }) => {
  const page = await browser.newPage();
  await signIn(page, "c_org_admin");
  await page.goto("/app/inbox?status=human");
  await expect(page.getByTestId("inbox-empty")).toBeVisible();
  await page.goto("/app/inbox");
  await expect(page.getByTestId("inbox-contact")).toHaveText([CONTACT]);
  await expect(page.getByTestId("inbox-mode")).toHaveText(["Agente"]);
  await page.close();

  const other = await browser.newPage();
  await signIn(other, "a_staff");
  const response = await other.goto(`/app/inbox/${TAKEOVER_ID}`);
  expect(response?.status()).toBe(404);
  await other.close();
});
