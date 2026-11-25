import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { apiToken, restRows, signIn } from "./helpers";

// La bandeja de aprobaciones (paso 4d-3d) con las del seed de Demo A: dos en A2
// (las ve y las decide el equipo de A2) y una en A1 (solo quien tiene A1). Las
// pruebas deciden, así que van en orden y necesitan el seed recién aplicado: el
// seed las vuelve a dejar pendientes cada vez. Decidir pasa por RLS y
// guard_approval con la sesión de la persona; ejecutar lo aprobado es del
// worker (probado en su integración), que aquí no está en marcha.
test.describe.configure({ mode: "serial" });

const A2_REPLY = "Responder: «Hola, tenemos hueco el lunes a las 9:00. ¿Te va bien?»";
const A2_BOOKING = "Reservar Primera visita el lunes, 3 de junio de 2030, 9:00";
const A1_REPLY = "Responder: «Buenas tardes, le confirmamos la cita del martes.»";
// Pide un encargado (seed a2_manager): el staff de A2 la ve por RLS, pero no la
// decide, así que ni le sale en la lista ni le cuenta (M-02, revisión de V10).
const A2_MANAGER = "Responder: «Le enviamos el presupuesto que nos pidió.»";
const A2_REPLY_ID = "5eed0009-0000-4000-8000-0000000000a1";
const A2_BOOKING_ID = "5eed0009-0000-4000-8000-0000000000a2";
const A2_MANAGER_ID = "5eed0009-0000-4000-8000-0000000000a4";
/** La conversación de la bandeja de la que sale la respuesta de A2 (seed, OA02). */
const A2_CONVERSATION_ID = "5eed000b-0000-4000-8000-0000000000b2";
const WCAG_21_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

test("el equipo de un local ve lo que espera en su local, y nada de otro", async ({ page }) => {
  await signIn(page, "a_staff");
  await page.goto("/app/approvals");
  await expect(page.getByRole("heading", { level: 1, name: "Aprobaciones" })).toBeVisible();
  await expect(page.getByTestId("approval-summary")).toHaveText([A2_REPLY, A2_BOOKING]);
  await expect(page.getByTestId("approval-location")).toHaveText(["A2 Norte", "A2 Norte"]);
  await expect(page.getByText(A1_REPLY)).toHaveCount(0);

  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running"));
  const results = await new AxeBuilder({ page }).withTags(WCAG_21_AA).analyze();
  expect(results.violations.map((v) => v.id)).toEqual([]);
});

test("cada persona ve y cuenta solo lo que puede decidir: la que pide un encargado, al encargado de la región", async ({ page, browser }) => {
  // Antes de decidir nada en este archivo (va en orden y es el único que decide las de Demo A).
  await signIn(page, "a_staff");
  await page.goto("/app/approvals");
  await expect(page.getByTestId("approval-summary")).toHaveText([A2_REPLY, A2_BOOKING]);
  await expect(page.getByText(A2_MANAGER)).toHaveCount(0);
  await expect(page.getByTestId("approvals-count")).toHaveText("2 pendientes");
  await expect(page.getByTestId("nav-approvals")).toHaveAccessibleDescription("2 aprobaciones pendientes");
  await page.goto("/app");
  await expect(page.getByTestId("home-task-approvals")).toContainText("2 aprobaciones esperan tu decisión");

  const manager = await (await browser.newContext()).newPage();
  await signIn(manager, "a_region_manager");
  await manager.goto("/app/approvals");
  const summaries = await manager.getByTestId("approval-summary").allInnerTexts();
  expect([...summaries].sort()).toEqual([A1_REPLY, A2_BOOKING, A2_MANAGER, A2_REPLY].sort());
  await expect(manager.getByTestId("approvals-count")).toHaveText("4 pendientes");
  await expect(manager.getByTestId("nav-approvals")).toHaveAccessibleDescription("4 aprobaciones pendientes");
  await manager.close();
});

test("el detalle de la respuesta: el texto entero, la conversación de la que salió y por qué (OA02)", async ({ page }) => {
  await signIn(page, "a_staff");
  await page.goto("/app/approvals");
  await page.getByTestId("approval").filter({ hasText: A2_REPLY }).getByTestId("approval-open").click();
  await expect(page).toHaveURL(new RegExp(`record=${A2_REPLY_ID}`));
  const drawer = page.getByTestId("preview-drawer");
  await expect(drawer.getByTestId("approval-detail-text")).toHaveText("Hola, tenemos hueco el lunes a las 9:00. ¿Te va bien?");
  // La conversación de la bandeja de la que salió (seed: la de Jorge en A2).
  await expect(drawer.getByTestId("approval-detail-contact")).toHaveText("Jorge Pérez");
  await expect(drawer.getByTestId("approval-detail-message").first()).toContainText("Quiero hablar con una persona, por favor.");
  await expect(drawer.getByTestId("approval-detail-open-conversation")).toHaveAttribute("href", `/app/inbox/${A2_CONVERSATION_ID}`);
  await expect(drawer).toContainText("Personal");
  await expect(drawer.getByTestId("approval-approve")).toBeEnabled();

  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running"));
  const results = await new AxeBuilder({ page }).include("[data-testid=preview-drawer]").withTags(WCAG_21_AA).analyze();
  expect(results.violations.map((v) => v.id)).toEqual([]);

  // El enlace se puede compartir: con la URL, el panel se abre con el detalle.
  await page.reload();
  await expect(page.getByTestId("preview-drawer").getByTestId("approval-detail-text")).toBeVisible();
  // Cerrar lo quita de la URL.
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("preview-drawer")).toHaveCount(0);
  await expect(page).not.toHaveURL(/record=/);
});

test("el detalle de la reserva: la hora en la zona del local; lo que no existe, sin dato; sin conversación, lo dice (OA02)", async ({ page }) => {
  await signIn(page, "a_staff");
  await page.goto(`/app/approvals?record=${A2_BOOKING_ID}`);
  const drawer = page.getByTestId("preview-drawer");
  // El resumen que vio quien aprueba, arriba; el seed no crea el servicio que nombra, así que su nombre sale «Sin dato».
  await expect(drawer).toContainText(A2_BOOKING);
  await expect(drawer.getByTestId("approval-detail")).toContainText("ServicioSin dato");
  await expect(drawer.getByTestId("approval-detail")).toContainText("3/6/30, 9:00");
  await expect(drawer.getByTestId("approval-detail-no-conversation")).toBeVisible();
  await expect(drawer.getByTestId("approval-detail-slot-passed")).toHaveCount(0);
});

test("una aprobación que no es de tu lista no abre detalle aunque la pongas en la URL (OA02)", async ({ page }) => {
  // La que pide un encargado: el staff de A2 la ve por RLS, pero no la decide.
  await signIn(page, "a_staff");
  await page.goto(`/app/approvals?record=${A2_MANAGER_ID}`);
  await expect(page.getByTestId("approval-summary")).toHaveText([A2_REPLY, A2_BOOKING]);
  await expect(page.getByTestId("preview-drawer")).toHaveCount(0);
  await expect(page.getByText("Le enviamos el presupuesto que nos pidió.")).toHaveCount(0);
});

test("aprobar la respuesta la decide con la sesión de quien aprueba y la saca de pendientes", async ({ page, request }) => {
  await signIn(page, "a_staff");
  await page.goto("/app/approvals");
  const reply = page.getByTestId("approval").filter({ hasText: A2_REPLY });
  await reply.getByTestId("approval-approve").click();
  await expect(page.getByTestId("approval-summary")).toHaveText([A2_BOOKING]);

  // Lo que quedó en la base de datos, leído con la sesión de esa persona (RLS).
  const token = await apiToken(request, "a_staff");
  const rows = (await restRows(request, token, `approvals?id=eq.${A2_REPLY_ID}&select=status,decided_at,decided_by`)) as {
    status: string;
    decided_at: string | null;
    decided_by: string | null;
  }[];
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ status: "approved" });
  expect(rows[0]?.decided_at).not.toBeNull();
  expect(rows[0]?.decided_by).not.toBeNull();
});

test("rechazar la reserva la saca de pendientes sin aprobarla", async ({ page, request }) => {
  await signIn(page, "a_staff");
  await page.goto("/app/approvals");
  await page.getByTestId("approval").filter({ hasText: A2_BOOKING }).getByTestId("approval-reject").click();
  await expect(page.getByTestId("approvals-empty")).toBeVisible();

  const token = await apiToken(request, "a_staff");
  const rows = (await restRows(request, token, `approvals?id=eq.${A2_BOOKING_ID}&select=status`)) as { status: string }[];
  expect(rows).toEqual([{ status: "rejected" }]);
});

test("quien lleva otro local solo ve lo de su local", async ({ page }) => {
  await signIn(page, "a_location_manager");
  await page.goto("/app/approvals");
  await expect(page.getByTestId("approval-summary")).toHaveText([A1_REPLY]);
  await expect(page.getByTestId("approval-location")).toHaveText(["A1 Norte"]);
});

test("otra organización no ve las aprobaciones de Demo A", async ({ page }) => {
  await signIn(page, "b_org_admin");
  await page.goto("/app/approvals");
  await expect(page.getByTestId("approvals-empty")).toBeVisible();
  await expect(page.getByText(A1_REPLY)).toHaveCount(0);
});
